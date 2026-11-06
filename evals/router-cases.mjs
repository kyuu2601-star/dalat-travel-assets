const HCMC=Object.freeze({country:'Việt Nam',city:'TP.HCM',latitude:10.7769,longitude:106.7009,source:'eval-public-coordinate'});

const groups=[
  {
    category:'place-current',expected:{decision:'API_TOOLS',intentHint:'PLACE_DISCOVERY',requiresFreshGps:true,planIntent:'PLACE_DISCOVERY',toolsContain:['search_places'],matched:true},
    messages:[
      'Tìm cửa hàng tiện lợi quanh đây','Có quán cà phê nào gần đây không?','Nhà thuốc xung quanh tôi','Tìm cây ATM ở gần đây','Quanh đây có chỗ ăn sáng nào?',
      'Cho tôi tiệm giặt ủi gần đây','Có gì chơi quanh đây?','Tìm nhà vệ sinh công cộng gần đây','Tôi cần siêu thị xung quanh','Tìm trạm xăng gần vị trí hiện tại',
      'Quán cơm nào gần đây?','Tìm cửa hàng tiện lợi gần tôi','Có khách sạn nào quanh chỗ tôi không?','Kiếm tiệm bánh gần chỗ đang đứng','Xung quanh vị trí này có hiệu thuốc nào?'
    ]
  },
  {
    category:'place-remote',expected:{decision:'API_TOOLS',intentHint:'PLACE_DISCOVERY',requiresFreshGps:false,planIntent:'PLACE_DISCOVERY',toolsContain:['search_places'],matched:true},
    messages:[
      'Tìm quán cà phê ở Đà Lạt','Ở Trùng Khánh có cửa hàng tiện lợi nào?','Tìm nhà hàng tại Quận 1','Khách sạn ở khu Hồng Nhai Động','Tìm nhà thuốc tại Đà Nẵng',
      'Có gì chơi ở Vũ Long?','Tìm siêu thị tại Thượng Hải','Quán ăn ngon ở Phượng Hoàng Cổ Trấn','Tìm bảo tàng ở TP.HCM','Cửa hàng tiện lợi tại trung tâm Đà Lạt',
      'Tìm tiệm bánh ở quận Du Trung','Nhà vệ sinh công cộng tại ga Trùng Khánh Bắc','Tìm trung tâm thương mại ở Nam Bình','Quán lẩu tại Trùng Khánh','Tìm công viên ở Thượng Hải'
    ]
  },
  {
    category:'route-current',expected:{decision:'API_TOOLS',intentHint:'ROUTE_MOBILITY',requiresFreshGps:true,planIntent:'ROUTE_MOBILITY',toolsContain:['resolve_place'],matched:true},
    messages:[
      'Chỉ đường từ vị trí hiện tại đến Dinh Độc Lập','Đi bộ đến Chợ Bến Thành như thế nào?','Dẫn đường tới Bảo tàng Chứng tích Chiến tranh','Lái xe đến sân bay Tân Sơn Nhất','Đường đi tới Hồ Xuân Hương',
      'Từ đây đi bộ đến Nhà thờ Đức Bà','Cho tôi route tới Hồng Nhai Động','Đi xe máy đến ga Trùng Khánh Bắc','Cách đi đến Quảng trường Nhân Dân','Đưa tôi tới nhà thuốc gần nhất',
      'Tìm đường đến khách sạn Yitel','Đi bộ tới ga metro gần nhất','Từ chỗ tôi đến trung tâm thương mại gần nhất','Chạy xe đến Bến xe Miền Đông','Dẫn tôi tới bệnh viện gần nhất'
    ]
  },
  {
    category:'route-two-point',expected:{decision:'API_TOOLS',intentHint:'ROUTE_MOBILITY',requiresFreshGps:false,planIntent:'ROUTE_MOBILITY',toolsContain:['resolve_place'],matched:true},
    messages:[
      'Từ Chợ Bến Thành đến Dinh Độc Lập đi thế nào?','Chỉ đường từ sân bay Tân Sơn Nhất đến phố đi bộ Nguyễn Huệ','Từ Hồ Xuân Hương đến quảng trường Lâm Viên','Đi từ Hồng Nhai Động đến Lễ đường Nhân Dân','Từ khách sạn Yitel đến ga Lâm Giang Môn',
      'Lái xe từ Quận 1 đến sân bay','Đi bộ từ Nhà thờ Đức Bà đến Bưu điện Thành phố','Từ ga Trùng Khánh Bắc tới Giải Phóng Bi','Từ chợ Đà Lạt đến ga Đà Lạt','Route từ Bến xe Miền Đông đến Landmark 81',
      'Từ Bảo tàng Hồ Chí Minh đến Chợ Bến Thành','Đi từ ga metro Bến Thành đến Thảo Cầm Viên','Từ Nam Bình đến Hồng Nhai Động bằng ô tô','Chỉ đường từ khách sạn đến bảo tàng','Từ sân bay Liên Khương đến trung tâm Đà Lạt'
    ]
  },
  {
    category:'weather',expected:{decision:'API_TOOLS',intentHint:'WEATHER_OUTDOOR',planIntent:'WEATHER_OUTDOOR',toolsContain:['weather'],matched:true},
    messages:[
      {text:'Thời tiết quanh đây thế nào?',requiresFreshGps:true},{text:'Ở đây có mưa không?',requiresFreshGps:true},{text:'Nhiệt độ chỗ tôi hiện tại bao nhiêu?',requiresFreshGps:true},
      {text:'Trời gần đây có tiện đi chơi không?',requiresFreshGps:true},{text:'Dự báo thời tiết tại vị trí hiện tại',requiresFreshGps:true},
      {text:'Thời tiết ở Đà Lạt hôm nay thế nào?',requiresFreshGps:false},{text:'Trùng Khánh ngày mai có mưa không?',requiresFreshGps:false},{text:'Nhiệt độ tại Thượng Hải bao nhiêu?',requiresFreshGps:false},
      {text:'Đà Nẵng cuối tuần có nắng không?',requiresFreshGps:false},{text:'Thời tiết ở Vũ Long có tiện đi bộ không?',requiresFreshGps:false},
      {text:'Dự báo mưa ở TP.HCM hôm nay',requiresFreshGps:false},{text:'Ở Phượng Hoàng Cổ Trấn có lạnh không?',requiresFreshGps:false},{text:'Thời tiết tại Nam Bình Trùng Khánh',requiresFreshGps:false},
      {text:'Hồ Xuân Hương chiều nay có mưa không?',requiresFreshGps:false},{text:'Nhiệt độ ở sân bay Liên Khương',requiresFreshGps:false}
    ]
  },
  {
    category:'safety-health',expected:{decision:'API_TOOLS',intentHint:'SAFETY_HEALTH',requiresFreshGps:true,planIntent:'SAFETY_HEALTH',toolsContain:['search_places'],matched:true},
    messages:[
      'Tôi bị đau bụng nhẹ, tìm nơi trợ giúp quanh đây','Tôi bị thương khi đang du lịch, bệnh viện gần nhất ở đâu?','Cần cấp cứu gần vị trí hiện tại','Tôi khó thở, đưa tôi tới bệnh viện','Tôi bị chảy máu, tìm cơ sở y tế gần nhất',
      'Đau ngực khi đi chơi, bệnh viện nào gần đây?','Tôi nghi bị ngộ độc thức ăn, tìm nơi trợ giúp','Tôi chóng mặt, tìm phòng khám gần nhất','Tôi bị sốt cao, cần bác sĩ gần đây','Tôi bị dị ứng, tìm bệnh viện quanh đây',
      'Bạn tôi bị ngất, cấp cứu ở đâu?','Tôi bị tiêu chảy nhẹ, tìm nhà thuốc gần nhất','Tôi cần bác sĩ vì đau đầu dữ dội','Bị bong gân khi đi bộ, phòng khám gần nhất','Trẻ bị sốt khi du lịch, tìm bệnh viện gần đây'
    ]
  },
  {
    category:'itinerary',expected:{decision:'PLANNER_MODEL',intentHint:'ITINERARY_PLANNING',requiresFreshGps:false,planIntent:'ITINERARY_PLANNING',toolsContain:['curated_places'],matched:true},
    messages:[
      'Lập lịch trình Đà Lạt một ngày chia sáng trưa chiều tối','Kế hoạch đi Trùng Khánh 3 ngày','Sắp xếp các điểm chơi ở Đà Lạt trong 2 ngày','Tạo itinerary một ngày ở TP.HCM','Lịch trình tham quan Vũ Long 2 ngày',
      'Plan chuyến đi Thượng Hải 4 ngày','Xếp lịch sáng chiều tối ở Trùng Khánh','Lập kế hoạch đi Phượng Hoàng Cổ Trấn 2 ngày','Lịch trình gia đình ở Đà Nẵng 3 ngày','Sắp xếp tour một ngày quanh trung tâm Đà Lạt',
      'Gợi ý lịch trình ăn chơi một ngày ở Quận 1','Kế hoạch du lịch Trùng Khánh từ sáng đến tối','Lập lịch đi bảo tàng và cà phê trong một ngày','Itinerary 2 ngày ưu tiên điểm gần nhau','Sắp xếp lịch trình không quá dày cho Đà Lạt'
    ]
  },
  {
    category:'guided-chat',expected:{decision:'GUIDED_CHAT',intentHint:'LOCAL_GUIDE',requiresFreshGps:false,planIntent:'LOCAL_GUIDE',toolsExact:[],matched:true},
    messages:[
      'Xin chào Pipi','Chào Pipi, khỏe không?','Nói chuyện phiếm với tôi đi','Kể chuyện du lịch vui đi','Ở Trùng Khánh nên cư xử thế nào trong quán ăn?',
      'Văn hóa xếp hàng ở Trung Quốc ra sao?','Có kiêng kỵ gì khi giao tiếp không?','Nên nói gì khi gặp người địa phương?','Cách ứng xử khi vào đền chùa','Phong tục ăn uống ở Trùng Khánh',
      'Phép lịch sự khi đi tàu điện là gì?','Hello Pipi','Hi Pipi','Kể truyền thuyết về thành phố đi','Cảm ơn Pipi nha'
    ]
  }
];

let sequence=0;
export const ROUTER_EVAL_CASES=groups.flatMap(group=>group.messages.map(item=>{
  const entry=typeof item==='string'?{text:item}:item;
  sequence+=1;
  return {
    id:`R${String(sequence).padStart(3,'0')}`,
    category:group.category,
    userMessage:entry.text,
    userLocation:entry.location||HCMC,
    expected:{...group.expected,...(entry.requiresFreshGps==null?{}:{requiresFreshGps:entry.requiresFreshGps}),...(entry.expected||{})}
  };
}));

