const HCMC=Object.freeze({country:'Việt Nam',city:'TP.HCM',latitude:10.7769,longitude:106.7009,source:'eval-public-coordinate'});

const placeCurrent={decision:'API_TOOLS',intentHint:'PLACE_DISCOVERY',requiresFreshGps:true,planIntent:'PLACE_DISCOVERY',toolsContain:['search_places'],matched:true};
const placeRemote={decision:'API_TOOLS',intentHint:'PLACE_DISCOVERY',requiresFreshGps:false,planIntent:'PLACE_DISCOVERY',toolsContain:['search_places'],matched:true};
const routeCurrent={decision:'API_TOOLS',intentHint:'ROUTE_MOBILITY',requiresFreshGps:true,planIntent:'ROUTE_MOBILITY',toolsContain:['resolve_place'],matched:true};
const routeTwoPoint={decision:'API_TOOLS',intentHint:'ROUTE_MOBILITY',requiresFreshGps:false,planIntent:'ROUTE_MOBILITY',toolsContain:['resolve_place'],matched:true};
const weatherCurrent={decision:'API_TOOLS',intentHint:'WEATHER_OUTDOOR',requiresFreshGps:true,planIntent:'WEATHER_OUTDOOR',toolsContain:['weather'],matched:true};
const weatherRemote={decision:'API_TOOLS',intentHint:'WEATHER_OUTDOOR',requiresFreshGps:false,planIntent:'WEATHER_OUTDOOR',toolsContain:['resolve_place','weather'],matched:true};
const safety={decision:'API_TOOLS',intentHint:'SAFETY_HEALTH',requiresFreshGps:true,planIntent:'SAFETY_HEALTH',toolsContain:['search_places'],matched:true};
const itinerary={decision:'PLANNER_MODEL',intentHint:'ITINERARY_PLANNING',requiresFreshGps:false,planIntent:'ITINERARY_PLANNING',toolsContain:['curated_places'],matched:true};
const guided={decision:'GUIDED_CHAT',intentHint:'LOCAL_GUIDE',requiresFreshGps:false,planIntent:'LOCAL_GUIDE',toolsExact:[],matched:true};

const groups=[
  {category:'knowledge-place-current',expected:placeCurrent,messages:[
    'Tìm tiệm bánh quanh đây','Quán cơm nào gần tôi?','Kiếm tiệm giặt ủi xung quanh','Tìm hiệu thuốc quanh chỗ mình','Có quán cà phê nào quanh tôi không?',
    'Tìm nhà vệ sinh gần vị trí này','Kiếm siêu thị gần tui','Cửa hàng tiện lợi quanh chỗ đang đứng','Tìm cây xăng gần mình','Có tiệm tạp hóa nào quanh đây?'
  ]},
  {category:'knowledge-place-remote',expected:placeRemote,messages:[
    'Tìm tiệm bánh ở Đà Lạt','Kiếm quán cơm tại Quận 1','Tìm tiệm giặt ủi ở Đà Nẵng','Có nhà thuốc nào tại Vũng Tàu?','Tìm quán cà phê ở Thượng Hải',
    'Kiếm siêu thị tại Trùng Khánh','Tìm nhà vệ sinh ở ga Trùng Khánh Bắc','Tìm bảo tàng tại Đà Lạt','Có cửa hàng tiện lợi nào ở Nam Bình?','Tìm công viên tại TP.HCM'
  ]},
  {category:'knowledge-route-current',expected:routeCurrent,messages:[
    'Tìm đường đến Dinh Độc Lập','Đưa tui tới Chợ Bến Thành','Dẫn mình tới Nhà thờ Đức Bà','Chạy xe đến sân bay Tân Sơn Nhất','Cách đi tới Bưu điện Thành phố',
    'Cho tôi route đến Hồ Xuân Hương','Lái xe tới quảng trường Lâm Viên','Dẫn đường đến Hồng Nhai Động','Đưa mình đến Lễ đường Nhân Dân','Tôi muốn di chuyển tới ga Trùng Khánh Bắc'
  ]},
  {category:'knowledge-route-two-point',expected:routeTwoPoint,messages:[
    'Từ Chợ Bến Thành tới Bưu điện Thành phố','Từ Dinh Độc Lập đến Nhà thờ Đức Bà','Từ sân bay Liên Khương qua Hồ Xuân Hương','Từ ga Đà Lạt đến quảng trường Lâm Viên','Từ Hồng Nhai Động tới Giải Phóng Bi',
    'Từ Lễ đường Nhân Dân đến ga Lâm Giang Môn','Từ Nam Bình tới Vũ Long','Từ TP.HCM đến Vũng Tàu','Từ Quận 1 tới sân bay Tân Sơn Nhất','Từ Bảo tàng Thành phố đến Chợ Bến Thành'
  ]},
  {category:'knowledge-weather-current',expected:weatherCurrent,messages:[
    'Trời quanh đây thế nào?','Chỗ tôi có mưa không?','Nhiệt độ vị trí hiện tại bao nhiêu?','Trời có nắng không?','Gần tôi có mưa lớn không?',
    'Dự báo thời tiết quanh tui','Ở đây lạnh không?','Trời mưa có tiện đi chơi không?','Gió mạnh quanh đây không?','Weather near me today'
  ]},
  {category:'knowledge-weather-remote',expected:weatherRemote,messages:[
    'Thời tiết ở Đà Nẵng hôm nay','Tại Đà Lạt có mưa không?','Nhiệt độ ở Thượng Hải bao nhiêu?','Trời tại Trùng Khánh có lạnh không?','Dự báo thời tiết ở Vũ Long',
    'Ở Nam Bình có nắng không?','Thời tiết tại Phượng Hoàng Cổ Trấn','Ở Bắc Kinh có gió mạnh không?','Dự báo mưa tại Thành Đô','Nhiệt độ ở Quảng Châu hôm nay'
  ]},
  {category:'knowledge-safety',expected:safety,messages:[
    'Tôi chóng mặt, cần trợ giúp quanh tôi','Tôi bị dị ứng, cần nơi trợ giúp gần mình','Đau đầu dữ dội, cần bác sĩ quanh đây','Tôi nghi ngộ độc thức ăn, cần y tế gần tui','Bị chảy máu, cần trợ giúp quanh mình',
    'Tôi khó thở, cần y tế gần tôi','Bạn tôi bị ngất, cần trợ giúp quanh đây','Tôi bị bong gân, cần bác sĩ gần mình','Bị tiêu chảy nhẹ, cần nơi trợ giúp quanh tôi','Trẻ sốt cao, cần y tế quanh đây'
  ]},
  {category:'knowledge-itinerary',expected:itinerary,messages:[
    'Lập lịch đi Đà Lạt một ngày','Xếp lịch tham quan Trùng Khánh 2 ngày','Plan chuyến đi Thượng Hải 3 ngày','Sắp xếp lịch ăn chơi ở Quận 1','Kế hoạch du lịch Vũ Long hai ngày',
    'Itinerary Đà Nẵng 4 ngày','Lập lịch bảo tàng và cà phê buổi chiều','Xếp lịch sáng trưa tối ở Đà Lạt','Travel plan cho Phượng Hoàng Cổ Trấn','Sắp xếp các điểm tham quan gần nhau'
  ]},
  {category:'knowledge-guided',expected:guided,messages:[
    'Hello Pipi','Hi Pipi, khỏe không?','Cảm ơn Pipi nha','Kể chuyện du lịch đi','Nói chuyện phiếm với tui',
    'Có kiêng kỵ gì khi giao tiếp?','Cách ứng xử khi vào chùa','Phong tục ăn uống địa phương','Nên nói gì với người địa phương?','Kể truyền thuyết thành phố đi'
  ]},
  {category:'knowledge-false-positive',messages:[
    {text:'Tìm nhà thuốc tại Đà Nẵng',expected:placeRemote},{text:'Tìm bảo tàng ở TP.HCM',expected:placeRemote},{text:'Kiếm bảo tàng tại Đà Nẵng',expected:placeRemote},
    {text:'Tìm tiệm bánh tại Đà Nẵng',expected:placeRemote},{text:'Tìm quán ăn ở Bảo Lộc',expected:placeRemote},{text:'Tìm nhà hàng tại Nắng Homestay Đà Lạt',expected:placeRemote},
    {text:'Lập lịch bảo tàng và cà phê một ngày',expected:itinerary},{text:'Lịch trình gia đình ở Đà Nẵng 3 ngày',expected:itinerary},
    {text:'Tìm đường tới Bảo tàng Chứng tích Chiến tranh',expected:routeCurrent},{text:'Chỉ đường đến Nắng Homestay Đà Lạt',expected:routeCurrent}
  ]}
];

let sequence=0;
export const KNOWLEDGE_EVAL_CASES=groups.flatMap(group=>group.messages.map(item=>{
  const entry=typeof item==='string'?{text:item}:item;sequence+=1;
  return {id:`K${String(sequence).padStart(3,'0')}`,category:group.category,userMessage:entry.text,userLocation:entry.location||HCMC,expected:{...(group.expected||{}),...(entry.expected||{})}};
}));

if(KNOWLEDGE_EVAL_CASES.length!==100)throw new Error(`Expected 100 knowledge eval cases, received ${KNOWLEDGE_EVAL_CASES.length}`);
