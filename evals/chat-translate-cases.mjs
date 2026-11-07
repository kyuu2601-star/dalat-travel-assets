const HCMC=Object.freeze({country:'Việt Nam',city:'TP.HCM',latitude:10.7769,longitude:106.7009,source:'eval-public-coordinate'});

const expected={
  placeCurrent:{decision:'API_TOOLS',intentHint:'PLACE_DISCOVERY',requiresFreshGps:true,planIntent:'PLACE_DISCOVERY',toolsContain:['search_places'],matched:true},
  placeRemote:{decision:'API_TOOLS',intentHint:'PLACE_DISCOVERY',requiresFreshGps:false,planIntent:'PLACE_DISCOVERY',toolsContain:['search_places'],matched:true},
  routeCurrent:{decision:'API_TOOLS',intentHint:'ROUTE_MOBILITY',requiresFreshGps:true,planIntent:'ROUTE_MOBILITY',toolsContain:['resolve_place'],matched:true},
  routeTwoPoint:{decision:'API_TOOLS',intentHint:'ROUTE_MOBILITY',requiresFreshGps:false,planIntent:'ROUTE_MOBILITY',toolsContain:['resolve_place'],matched:true},
  weatherCurrent:{decision:'API_TOOLS',intentHint:'WEATHER_OUTDOOR',requiresFreshGps:true,planIntent:'WEATHER_OUTDOOR',toolsContain:['weather'],matched:true},
  weatherRemote:{decision:'API_TOOLS',intentHint:'WEATHER_OUTDOOR',requiresFreshGps:false,planIntent:'WEATHER_OUTDOOR',toolsContain:['resolve_place','weather'],matched:true},
  safety:{decision:'API_TOOLS',intentHint:'SAFETY_HEALTH',requiresFreshGps:true,planIntent:'SAFETY_HEALTH',toolsContain:['search_places'],matched:true},
  itinerary:{decision:'PLANNER_MODEL',intentHint:'ITINERARY_PLANNING',requiresFreshGps:false,planIntent:'ITINERARY_PLANNING',toolsContain:['curated_places'],matched:true},
  guided:{decision:'GUIDED_CHAT',intentHint:'LOCAL_GUIDE',requiresFreshGps:false,planIntent:'LOCAL_GUIDE',toolsExact:[],matched:true},
  utility:{decision:'MODEL_ANSWER',intentHint:'TRAVEL_UTILITY',requiresFreshGps:false,planIntent:'TRAVEL_UTILITY',toolsExact:[],matched:true}
};

const chatGroups=[
  {category:'chat-place-current',expected:expected.placeCurrent,messages:[
    'Kiếm quán bún bò gần tôi','Tìm tiệm trà sữa quanh chỗ mình','Có ATM nào quanh vị trí này?','Tìm nhà vệ sinh gần chỗ đang đứng','Quanh tui có cửa hàng tiện lợi nào?'
  ]},
  {category:'chat-place-remote',expected:expected.placeRemote,messages:[
    'Tìm quán lẩu ở Trùng Khánh','Kiếm tiệm cà phê tại Đà Lạt','Có nhà thuốc nào ở Quận 3?','Tìm siêu thị tại Thượng Hải','Nhà vệ sinh công cộng ở ga Hồng Kiều'
  ]},
  {category:'chat-route-current',expected:expected.routeCurrent,messages:[
    'Đưa tui tới Dinh Độc Lập','Tìm đường đến ga Bến Thành','Dẫn mình tới Chợ Đà Lạt','Cách đi đến Hồng Nhai Động','Cho tôi route tới sân bay Liên Khương'
  ]},
  {category:'chat-route-two-point',expected:expected.routeTwoPoint,messages:[
    'Từ Nhà thờ Đức Bà đến Chợ Bến Thành','Từ Hồ Xuân Hương tới ga Đà Lạt','Từ Hồng Nhai Động qua Giải Phóng Bi','Từ sân bay Tân Sơn Nhất đến Quận 1','Từ ga Trùng Khánh Bắc tới Nam Bình'
  ]},
  {category:'chat-weather-current',expected:expected.weatherCurrent,messages:[
    'Trời chỗ tôi có mưa không?','Nhiệt độ quanh đây bao nhiêu?','Dự báo thời tiết gần tui','Ở đây có nắng không?','Gió quanh vị trí hiện tại có mạnh không?'
  ]},
  {category:'chat-weather-remote',expected:expected.weatherRemote,messages:[
    'Thời tiết ở Thành Đô hôm nay','Tại Bắc Kinh có mưa không?','Nhiệt độ ở Quảng Châu bao nhiêu?','Dự báo thời tiết tại Phượng Hoàng Cổ Trấn','Ở Thượng Hải có lạnh không?'
  ]},
  {category:'chat-safety',expected:expected.safety,messages:[
    'Tôi chóng mặt, cần trợ giúp quanh tôi','Tôi bị dị ứng, cần y tế gần mình','Tôi bị móc túi, cần trợ giúp quanh đây','Tôi mất đồ, cần công an gần tôi','Tôi khó thở, cần nơi hỗ trợ quanh mình'
  ]},
  {category:'chat-itinerary',expected:expected.itinerary,messages:[
    'Lập lịch Đà Lạt 2 ngày','Xếp lịch ăn chơi Trùng Khánh một ngày','Plan chuyến đi Bắc Kinh 4 ngày','Itinerary Thượng Hải 3 ngày','Sắp xếp các điểm ở Quận 1 theo buổi'
  ]},
  {category:'chat-guided',expected:expected.guided,messages:[
    'Chào Pipi nha','Kể chuyện vui đi Pipi','Ở Trung Quốc có kiêng kỵ gì?','Cách ứng xử khi đi tàu điện','Cảm ơn Pipi nhiều'
  ]},
  {category:'chat-utility',expected:expected.utility,messages:[
    'Tỷ giá nhân dân tệ hôm nay','SIM du lịch Trung Quốc dùng thế nào?','Wi-Fi khi đi Trùng Khánh ra sao?','Tôi cần gửi hành lý','Hotline hỗ trợ du lịch là gì?'
  ]}
];

let chatSequence=0;
export const TEXT_CHAT_EVAL_CASES=chatGroups.flatMap(group=>group.messages.map(message=>({
  id:`C${String(++chatSequence).padStart(3,'0')}`,category:group.category,userMessage:message,userLocation:HCMC,expected:group.expected
})));

const viToZh=[
  ['Xin chào, nhà vệ sinh ở đâu?','你好，请问洗手间在哪里？',[['洗手间','厕所'],['哪里','哪儿']]],
  ['Chỉ đường giúp tôi đến Hồng Nhai Động.','请给我指路去洪崖洞。',[['洪崖洞'],['指路','怎么走','带我去']]],
  ['Đi bộ đến đó mất bao lâu?','走路到那里需要多长时间？',[['走路','步行'],['多久','多长时间']]],
  ['Nhà thuốc gần nhất ở đâu?','最近的药店在哪里？',[['药店','药房'],['最近','最接近']]],
  ['Tôi bị dị ứng đậu phộng.','我对花生过敏。',[['花生'],['过敏']]],
  ['Làm ơn gọi giúp tôi một chiếc taxi.','请帮我叫一辆出租车。',[['出租车','的士'],['叫','打','坐']]],
  ['Món này giá bao nhiêu?','这个多少钱？',[['多少'],['钱','价格']]],
  ['Ở đây có thể thanh toán bằng Alipay không?','这里可以用支付宝付款吗？',[['支付宝'],['付款','支付']]],
  ['Tôi muốn nhận phòng khách sạn.','我想办理酒店入住。',[['酒店'],['入住','登记']]],
  ['Chuyến tàu điện cuối cùng lúc mấy giờ?','最后一班地铁是几点？',[['最后'],['地铁'],['几点']]],
  ['Tôi không ăn cay.','我不吃辣。',[['不吃辣','不要辣']]],
  ['Cho tôi một vé đến ga Trùng Khánh Bắc.','请给我一张去重庆北站的票。',[['重庆北站'],['一张','票']]],
  ['Tôi cần có mặt lúc 8 giờ sáng.','我早上八点需要到达。',[['八点','8点'],['早上','上午']]],
  ['Tổng cộng là 120 nhân dân tệ đúng không?','一共是一百二十元，对吗？',[['一百二十','120'],['元','人民币']]],
  ['Khách sạn Yitel nằm ở đường nào?','和颐酒店在哪条路上？',[['和颐','Yitel'],['路']]],
  ['Tôi làm mất hộ chiếu.','我的护照丢了。',[['护照'],['丢','遗失','失去']]],
  ['Làm ơn đưa tôi đến đồn cảnh sát gần nhất.','请带我去最近的派出所。',[['派出所','警察局'],['最近']]],
  ['Tôi có hai vali và một ba lô.','我有两个行李箱和一个背包。',[['两个','2个'],['行李箱'],['背包']]],
  ['Xe buýt này có đến sân bay không?','这辆公交车去机场吗？',[['公交车','巴士'],['机场']]],
  ['Bảo tàng đóng cửa lúc mấy giờ?','博物馆几点关门？',[['博物馆'],['关门','闭馆'],['几点','什么时候']]],
  ['Trời đang mưa, tôi cần mua ô.','正在下雨，我需要买一把伞。',[['下雨'],['伞']]],
  ['Xin dừng ở cổng số 2.','请在二号门停车。',[['二号门','2号门'],['停车','停']]],
  ['Tôi muốn đến Giải Phóng Bi trước 7 giờ tối.','我想在晚上七点前到达解放碑。',[['解放碑'],['七点','7点'],['晚上']]],
  ['Có cửa hàng tiện lợi nào mở 24 giờ không?','有二十四小时营业的便利店吗？',[['二十四小时','24小时'],['便利店']]],
  ['Địa chỉ khách sạn là số 30 đường Lâm Giang Chi.','酒店地址是临江支路三十号。',[['临江支路'],['三十号','30号']]]
];

const zhToVi=[
  ['你好，请问洗手间在哪里？','Xin chào, cho hỏi nhà vệ sinh ở đâu?',[['nhà vệ sinh','phòng vệ sinh'],['ở đâu']]],
  ['请带我去洪崖洞。','Làm ơn đưa tôi đến Hồng Nhai Động.',[['hồng nhai động','hongya'],['đưa tôi','dẫn tôi','đến']]],
  ['走路到那里需要多长时间？','Đi bộ đến đó mất bao lâu?',[['đi bộ'],['bao lâu','mất bao nhiêu thời gian']]],
  ['最近的药店在哪里？','Nhà thuốc gần nhất ở đâu?',[['nhà thuốc','hiệu thuốc'],['gần nhất']]],
  ['我对花生过敏。','Tôi bị dị ứng đậu phộng.',[['dị ứng'],['đậu phộng','lạc']]],
  ['请帮我叫一辆出租车。','Làm ơn gọi giúp tôi một chiếc taxi.',[['taxi','xe taxi'],['gọi']]],
  ['这个多少钱？','Món này giá bao nhiêu?',[['bao nhiêu'],['giá','tiền']]],
  ['这里可以用支付宝付款吗？','Ở đây có thể thanh toán bằng Alipay không?',[['alipay','chi phó bảo'],['thanh toán']]],
  ['我想办理酒店入住。','Tôi muốn làm thủ tục nhận phòng khách sạn.',[['nhận phòng'],['khách sạn']]],
  ['最后一班地铁是几点？','Chuyến tàu điện cuối cùng lúc mấy giờ?',[['cuối cùng','chuyến cuối'],['tàu điện','metro'],['mấy giờ']]],
  ['我不吃辣。','Tôi không ăn cay.',[['không ăn cay','không cay']]],
  ['请给我一张去重庆北站的票。','Cho tôi một vé đến ga Trùng Khánh Bắc.',[['một vé','1 vé'],['ga trùng khánh bắc']]],
  ['我早上八点需要到达。','Tôi cần đến nơi lúc 8 giờ sáng.',[['8 giờ','tám giờ'],['sáng']]],
  ['一共是一百二十元，对吗？','Tổng cộng là 120 nhân dân tệ, đúng không?',[['120','một trăm hai mươi'],['nhân dân tệ','tệ']]],
  ['和颐酒店在哪条路上？','Khách sạn Yitel nằm ở đường nào?',[['yitel','khách sạn hòa di'],['đường nào']]],
  ['我的护照丢了。','Tôi làm mất hộ chiếu.',[['mất','thất lạc'],['hộ chiếu']]],
  ['请带我去最近的派出所。','Làm ơn đưa tôi đến đồn cảnh sát gần nhất.',[['đồn cảnh sát','đồn công an'],['gần nhất']]],
  ['我有两个行李箱和一个背包。','Tôi có hai vali và một ba lô.',[['hai vali','2 vali','hai va li'],['một ba lô','1 ba lô']]],
  ['这辆公交车去机场吗？','Xe buýt này có đến sân bay không?',[['xe buýt','xe bus'],['sân bay']]],
  ['博物馆几点关门？','Bảo tàng đóng cửa lúc mấy giờ?',[['bảo tàng'],['đóng cửa'],['mấy giờ']]],
  ['正在下雨，我需要买一把伞。','Trời đang mưa, tôi cần mua một chiếc ô.',[['mưa'],['mua'],['ô','dù']]],
  ['请在二号门停车。','Xin dừng ở cổng số 2.',[['cổng số 2','cổng 2','cửa số 2','cửa 2'],['dừng','đỗ xe']]],
  ['我想在晚上七点前到达解放碑。','Tôi muốn đến Giải Phóng Bi trước 7 giờ tối.',[['giải phóng bi','jiefangbei'],['7 giờ','bảy giờ'],['tối']]],
  ['有二十四小时营业的便利店吗？','Có cửa hàng tiện lợi nào mở 24 giờ không?',[['cửa hàng tiện lợi'],['24 giờ','hai mươi bốn giờ']]],
  ['酒店地址是临江支路三十号。','Địa chỉ khách sạn là số 30 đường Lâm Giang Chi.',[['khách sạn'],['30','ba mươi'],['lâm giang chi','linjiang']]]
];

let translateSequence=0;
const translationCase=(direction,[sourceText,reference,requiredGroups])=>({
  id:`T${String(++translateSequence).padStart(3,'0')}`,category:`translate-${direction}`,direction,
  sourceLanguage:direction==='vi-zh'?'vi':'zh-Hans',targetLanguage:direction==='vi-zh'?'zh-Hans':'vi',sourceText,reference,requiredGroups
});
export const TRANSLATE_EVAL_CASES=[...viToZh.map(item=>translationCase('vi-zh',item)),...zhToVi.map(item=>translationCase('zh-vi',item))];

if(TEXT_CHAT_EVAL_CASES.length!==50)throw new Error(`Expected 50 text chat cases, received ${TEXT_CHAT_EVAL_CASES.length}`);
if(TRANSLATE_EVAL_CASES.length!==50)throw new Error(`Expected 50 translate cases, received ${TRANSLATE_EVAL_CASES.length}`);
