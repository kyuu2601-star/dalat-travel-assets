(function () {
  const existing = window.CHINA_NAV_CONFIG || {};
  window.CHINA_NAV_CONFIG = {
    enabled: existing.enabled !== false,
    debug: Boolean(existing.debug),
    amap: {
      jsKey: existing.amap?.jsKey || 'PASTE_AMAP_JS_KEY_HERE',
      securityJsCode: existing.amap?.securityJsCode || 'PASTE_AMAP_SECURITY_JS_CODE_HERE',
      version: existing.amap?.version || '2.0'
    },
    ai: {
      enabled: existing.ai?.enabled !== false,
      endpoint: existing.ai?.endpoint || window.CONFIG?.WORKER_URL || '',
      timeoutMs: Number(existing.ai?.timeoutMs || 12000)
    },
    route: {
      gpsPollMs: Number(existing.route?.gpsPollMs || 1500),
      stepSnapMeters: Number(existing.route?.stepSnapMeters || 35),
      destinationCoordinateSystem: existing.route?.destinationCoordinateSystem || 'wgs84'
    },
    chinaAliases: existing.chinaAliases || ['trung quoc','china','cn','中国','中华人民共和国'],
    chongqingAliases: existing.chongqingAliases || ['trung khanh','chongqing','重庆','重庆市']
  };
})();
