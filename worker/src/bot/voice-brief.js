const short = (value, limit = 140) => String(value ?? '').trim().slice(0, limit);

function distance(value) {
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters < 0) return '';
  return meters < 1000 ? `${Math.round(meters)} mét` : `${(meters / 1000).toFixed(1)} ki-lô-mét`;
}

// A spoken answer is built only from the evidence the map/weather tools returned.
// It can leave out detail; it cannot invent a fact while the full answer is pending.
export function buildVoiceBrief(state, intent) {
  if (intent === 'WEATHER_OUTDOOR' && state.weather?.current) {
    const current = state.weather.current;
    const place = short(state.weatherTarget?.localizedName || state.weatherTarget?.name || 'vị trí này', 90);
    const condition = short(current.condition || 'chưa rõ trạng thái trời', 80);
    const temperature = current.temperature !== null && current.temperature !== undefined && Number.isFinite(Number(current.temperature)) ? `, ${Math.round(Number(current.temperature))} độ` : '';
    const alert = state.weather.alerts?.find(item => item?.title || item?.eventType);
    return `Ở ${place}, hiện ${condition}${temperature}.${alert ? ` Có cảnh báo ${short(alert.title || alert.eventType, 90)}; bạn nên kiểm tra trước khi ra ngoài.` : ''}`;
  }

  const route = state.routes?.[0];
  if (intent === 'ROUTE_MOBILITY' && route) {
    const destination = short(state.lastPlace?.localizedName || state.lastPlace?.name || 'điểm đến', 90);
    const duration = Number.isFinite(Number(route.duration)) ? ` khoảng ${Math.max(1, Math.round(Number(route.duration) / 60))} phút` : '';
    return `Pipi đã tìm được đường tới ${destination}${duration}. Chi tiết tuyến ở phần chat bên dưới.`;
  }

  const place = state.details || state.lastPlace;
  if (state.namedPlaceSearch && place?.name) {
    const name = short(place.localizedName || place.name, 100);
    const opening = place.openNow === true ? ' Hiện đang mở cửa.' : place.openNow === false ? ' Hiện đang đóng cửa.' : '';
    const busy = state.busyness?.available && state.busyness?.label ? ` Mức độ đông: ${short(state.busyness.label, 40)}.` : '';
    return `Pipi tìm được ${name}.${opening}${busy} Thông tin và vị trí ở phần chat bên dưới.`;
  }

  if (state.nearby) {
    const pois = Array.isArray(state.nearby.pois) ? state.nearby.pois : [];
    if (!pois.length) return 'API bản đồ chưa trả địa điểm phù hợp. Pipi chưa thể kết luận khu vực này không có địa điểm đó.';
    const first = pois[0];
    const name = short(first.localizedName || first.name || 'một địa điểm', 100);
    const proximity = distance(first.distance);
    return `Pipi tìm được ${pois.length} địa điểm. Gần nhất là ${name}${proximity ? `, cách khoảng ${proximity}` : ''}. Danh sách nằm ở phần chat bên dưới.`;
  }

  if (state.busyness?.available && place?.name) {
    return `${short(place.localizedName || place.name, 100)} hiện ${short(state.busyness.label || 'có dữ liệu độ đông', 50)}. Pipi đang soạn thông tin chi tiết bên dưới.`;
  }

  if (route) return `Pipi tìm được một tuyến đường dài ${distance(route.distance) || 'chưa rõ khoảng cách'}. Chi tiết ở phần chat bên dưới.`;
  return '';
}
