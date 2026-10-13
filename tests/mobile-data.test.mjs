import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';
import { readFile } from 'node:fs/promises';

test('Android WebView origin can read the local data manifest', async () => {
  const env = {
    ALLOWED_ORIGINS: 'https://kyuu2601-star.github.io,https://localhost,http://localhost,capacitor://localhost',
    DB: {
      prepare(sql) {
        assert.match(sql, /COUNT\(\*\).*MAX\(id\).*MAX\(updated_at\)/s);
        return {
          first: async () => ({ count: 12, max_id: 19, updated_at: '2026-10-09 12:30:00' })
        };
      }
    }
  };

  const response = await worker.fetch(new Request('https://travelos.test/api/data-manifest', {
    headers: { Origin: 'https://localhost' }
  }), env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://localhost');
  assert.equal(payload.version, '12-19-2026-10-09 12:30:00');
  assert.equal(payload.count, 12);
  assert.equal(payload.dataPath, '/api/places?limit=5000');
});

test('unknown WebView origins stay blocked', async () => {
  const response = await worker.fetch(new Request('https://travelos.test/api/data-manifest', {
    headers: { Origin: 'https://untrusted.invalid' }
  }), {
    ALLOWED_ORIGINS: 'https://localhost',
    DB: { prepare() { throw new Error('DB should not be touched'); } }
  });

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('signed APK downloads are served as immutable attachments', async () => {
  const bytes = new Uint8Array([80, 75, 3, 4]);
  const object = {
    size: bytes.byteLength,
    body: bytes,
    httpEtag: '"apk-etag"',
    writeHttpMetadata() {}
  };
  const env = {
    IMAGES: {
      get: async key => key === 'downloads/TravelOS-v1.0.0.apk' ? object : null,
      head: async key => key === 'downloads/TravelOS-v1.0.0.apk' ? object : null
    }
  };

  const response = await worker.fetch(new Request('https://travelos.test/downloads/TravelOS-v1.0.0.apk'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/vnd.android.package-archive');
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="TravelOS-v1.0.0.apk"');
  assert.match(response.headers.get('Cache-Control'), /immutable/);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test('native startup defers bot health and external reverse geocoding', async () => {
  const [chatSource, appSource] = await Promise.all([
    readFile(new URL('../chat.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8')
  ]);
  assert.match(chatSource, /if \(window\.TRAVELOS_NATIVE\) return \{ ok:true, deferred:true \}/);
  assert.match(appSource, /const inferred = inferNativeLocation\(position\)[\s\S]*if \(window\.TRAVELOS_NATIVE\)/);
  assert.match(appSource, /if \(inferred\)[\s\S]*applyDetectedLocation\(inferred\)/);
});

test('native UI draws edge-to-edge while interactive controls respect system bars', async () => {
  const [css, widget, capacitorConfig, activity, manifest, styles] = await Promise.all([
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
    readFile(new URL('../widget.js', import.meta.url), 'utf8'),
    readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../android/app/src/main/java/com/kyuu2601/travelos/MainActivity.java', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/res/values/styles.xml', import.meta.url), 'utf8')
  ]);
  assert.match(css, /--app-safe-bottom: max\(env\(safe-area-inset-bottom, 0px\), var\(--safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /body \{[\s\S]*padding: 0;/);
  assert.match(widget, /readCssPixels\('--safe-area-inset-bottom', 'paddingBottom'\)/);
  assert.match(widget, /Math\.max\(edgeY \+ safe\.bottom, keyboardOpen \? edgeY : 76\)/);
  assert.match(widget, /viewport\.height - bottomClearance - buttonSize/);
  assert.equal(capacitorConfig.plugins.SystemBars.insetsHandling, 'disable');
  assert.equal(capacitorConfig.plugins.SystemBars.initialViewportFitValueHint, 'cover');
  assert.match(activity, /setOnApplyWindowInsetsListener/);
  assert.match(activity, /--safe-area-inset-bottom/);
  assert.match(activity, /content\.setPadding\(0, 0, 0, 0\)/);
  assert.doesNotMatch(activity, /setPadding\([\s\S]{0,80}systemBarInsets/);
  assert.match(activity, /setBackgroundDrawable\(new ColorDrawable\(Color\.rgb\(2, 6, 23\)\)\)/);
  assert.match(activity, /setDecorFitsSystemWindows\(getWindow\(\), false\)/);
  assert.match(manifest, /android:theme="@style\/AppTheme\.NoActionBar"/);
  assert.doesNotMatch(manifest, /android:theme="@style\/AppTheme\.NoActionBarLaunch"/);
  assert.match(styles, /android:windowBackground">#020617/);
});

test('China mode preloads AMap and paints the map while Route 2.0 runs', async () => {
  const [loader, navigation, provider] = await Promise.all([
    readFile(new URL('../china-navigation/china-loader.js', import.meta.url), 'utf8'),
    readFile(new URL('../china-navigation/travel-navigation.js', import.meta.url), 'utf8'),
    readFile(new URL('../china-navigation/amap-provider.js', import.meta.url), 'utf8')
  ]);
  assert.match(loader, /AMapProvider\?\.ensureSdk\?\.\(\)/);
  assert.match(navigation, /Promise\.allSettled\(\[/);
  assert.match(navigation, /mapPromise,[\s\S]*planRoute\(origin, resolvedDestination, state\.mode\)/);
  assert.match(provider, /viewMode:'3D'/);
  assert.match(provider, /pitch:45/);
  assert.match(provider, /showBuildingBlock:true/);
});
