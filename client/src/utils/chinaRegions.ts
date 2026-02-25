/**
 * 中国省市区县数据字典
 * 仅支持首字母快速检索
 * 
 * 首字母规则：
 * - 省份：取省份名称每个汉字拼音首字母（如：湖北省=HBS，北京市=BJS）
 * - 城市：取城市名称每个汉字拼音首字母（如：十堰市=SYS，武汉市=WHS）
 * - 区县：取区县名称每个汉字拼音首字母（如：茅箭区=MJQ）
 * - 完整路径：省份+城市+区县首字母（如：湖北省十堰市茅箭区=HBSSYSMJQ）
 */

// 地区数据结构
export interface RegionData {
  name: string;           // 地区名称
  abbreviation: string;   // 拼音首字母缩写
  level: 'province' | 'city' | 'district';  // 层级
  parent?: string;        // 父级名称
}

// 所有地区数据
const allRegions: RegionData[] = [];

// 省份数据
const provinceData: { name: string; abbreviation: string }[] = [
  { name: '北京市', abbreviation: 'BJS' },
  { name: '天津市', abbreviation: 'TJS' },
  { name: '河北省', abbreviation: 'HBS' },
  { name: '山西省', abbreviation: 'SXS' },
  { name: '内蒙古自治区', abbreviation: 'NMZZQ' },
  { name: '辽宁省', abbreviation: 'LNS' },
  { name: '吉林省', abbreviation: 'JLS' },
  { name: '黑龙江省', abbreviation: 'HLJS' },
  { name: '上海市', abbreviation: 'SHS' },
  { name: '江苏省', abbreviation: 'JSS' },
  { name: '浙江省', abbreviation: 'ZJS' },
  { name: '安徽省', abbreviation: 'AHS' },
  { name: '福建省', abbreviation: 'FJS' },
  { name: '江西省', abbreviation: 'JXS' },
  { name: '山东省', abbreviation: 'SDS' },
  { name: '河南省', abbreviation: 'HNS' },
  { name: '湖北省', abbreviation: 'HBS' },
  { name: '湖南省', abbreviation: 'HNS' },
  { name: '广东省', abbreviation: 'GDS' },
  { name: '广西壮族自治区', abbreviation: 'GXZZZZQ' },
  { name: '海南省', abbreviation: 'HNS' },
  { name: '重庆市', abbreviation: 'CQS' },
  { name: '四川省', abbreviation: 'SCS' },
  { name: '贵州省', abbreviation: 'GZS' },
  { name: '云南省', abbreviation: 'YNS' },
  { name: '西藏自治区', abbreviation: 'XZZZQ' },
  { name: '陕西省', abbreviation: 'SXS' },
  { name: '甘肃省', abbreviation: 'GSS' },
  { name: '青海省', abbreviation: 'QHS' },
  { name: '宁夏回族自治区', abbreviation: 'NXHZZZQ' },
  { name: '新疆维吾尔自治区', abbreviation: 'XJWEZZQ' },
  { name: '台湾省', abbreviation: 'TWS' },
  { name: '香港特别行政区', abbreviation: 'XGTBXZQ' },
  { name: '澳门特别行政区', abbreviation: 'AMTBXZQ' },
];

// 城市及其区县数据（按省份分组）
const cityDataByProvince: Record<string, { name: string; abbreviation: string; districts?: { name: string; abbreviation: string }[] }[]> = {
  '北京市': [
    { name: '东城区', abbreviation: 'DCQ' },
    { name: '西城区', abbreviation: 'XCQ' },
    { name: '朝阳区', abbreviation: 'CYQ' },
    { name: '丰台区', abbreviation: 'FTQ' },
    { name: '石景山区', abbreviation: 'SJSQ' },
    { name: '海淀区', abbreviation: 'HDQ' },
    { name: '门头沟区', abbreviation: 'MTGQ' },
    { name: '房山区', abbreviation: 'FSQ' },
    { name: '通州区', abbreviation: 'TZQ' },
    { name: '顺义区', abbreviation: 'SYQ' },
    { name: '昌平区', abbreviation: 'CPQ' },
    { name: '大兴区', abbreviation: 'DXQ' },
    { name: '怀柔区', abbreviation: 'HRQ' },
    { name: '平谷区', abbreviation: 'PGQ' },
    { name: '密云区', abbreviation: 'MYQ' },
    { name: '延庆区', abbreviation: 'YQQ' },
  ],
  '天津市': [
    { name: '和平区', abbreviation: 'HPQ' },
    { name: '河东区', abbreviation: 'HDQ' },
    { name: '河西区', abbreviation: 'HXQ' },
    { name: '南开区', abbreviation: 'NKQ' },
    { name: '河北区', abbreviation: 'HBQ' },
    { name: '红桥区', abbreviation: 'HQQ' },
    { name: '东丽区', abbreviation: 'DLQ' },
    { name: '西青区', abbreviation: 'XQQ' },
    { name: '津南区', abbreviation: 'JNQ' },
    { name: '北辰区', abbreviation: 'BCQ' },
    { name: '武清区', abbreviation: 'WQQ' },
    { name: '宝坻区', abbreviation: 'BDQ' },
    { name: '滨海新区', abbreviation: 'BHXQ' },
    { name: '宁河区', abbreviation: 'NHQ' },
    { name: '静海区', abbreviation: 'JHQ' },
    { name: '蓟州区', abbreviation: 'JZQ' },
  ],
  '河北省': [
    { 
      name: '石家庄市', abbreviation: 'SJZS',
      districts: [
        { name: '长安区', abbreviation: 'CAQ' },
        { name: '桥西区', abbreviation: 'QXQ' },
        { name: '新华区', abbreviation: 'XHQ' },
        { name: '井陉矿区', abbreviation: 'JXKQ' },
        { name: '裕华区', abbreviation: 'YHQ' },
        { name: '藁城区', abbreviation: 'GCQ' },
        { name: '鹿泉区', abbreviation: 'LQQ' },
        { name: '栾城区', abbreviation: 'LCQ' },
        { name: '井陉县', abbreviation: 'JXX' },
        { name: '正定县', abbreviation: 'ZDX' },
        { name: '行唐县', abbreviation: 'XTX' },
        { name: '灵寿县', abbreviation: 'LSX' },
        { name: '高邑县', abbreviation: 'GYX' },
        { name: '深泽县', abbreviation: 'SZX' },
        { name: '赞皇县', abbreviation: 'ZHX' },
        { name: '无极县', abbreviation: 'WJX' },
        { name: '平山县', abbreviation: 'PSX' },
        { name: '元氏县', abbreviation: 'YSX' },
        { name: '赵县', abbreviation: 'ZX' },
        { name: '辛集市', abbreviation: 'XJS' },
        { name: '晋州市', abbreviation: 'JZS' },
        { name: '新乐市', abbreviation: 'XLS' },
      ]
    },
    { 
      name: '唐山市', abbreviation: 'TSS',
      districts: [
        { name: '路南区', abbreviation: 'LNQ' },
        { name: '路北区', abbreviation: 'LBQ' },
        { name: '古冶区', abbreviation: 'GYQ' },
        { name: '开平区', abbreviation: 'KPQ' },
        { name: '丰南区', abbreviation: 'FNQ' },
        { name: '丰润区', abbreviation: 'FRQ' },
        { name: '曹妃甸区', abbreviation: 'CFDQ' },
        { name: '滦南县', abbreviation: 'LNX' },
        { name: '乐亭县', abbreviation: 'LTX' },
        { name: '迁西县', abbreviation: 'QXX' },
        { name: '玉田县', abbreviation: 'YTX' },
        { name: '遵化市', abbreviation: 'ZHS' },
        { name: '迁安市', abbreviation: 'QAS' },
        { name: '滦州市', abbreviation: 'LZS' },
      ]
    },
    { name: '秦皇岛市', abbreviation: 'QHDS' },
    { name: '邯郸市', abbreviation: 'HDS' },
    { name: '邢台市', abbreviation: 'XTS' },
    { name: '保定市', abbreviation: 'BDS' },
    { name: '张家口市', abbreviation: 'ZJKS' },
    { name: '承德市', abbreviation: 'CDS' },
    { name: '沧州市', abbreviation: 'CZS' },
    { name: '廊坊市', abbreviation: 'LFS' },
    { name: '衡水市', abbreviation: 'HSS' },
  ],
  '山西省': [
    { name: '太原市', abbreviation: 'TYS' },
    { name: '大同市', abbreviation: 'DTS' },
    { name: '阳泉市', abbreviation: 'YQS' },
    { name: '长治市', abbreviation: 'CZS' },
    { name: '晋城市', abbreviation: 'JCS' },
    { name: '朔州市', abbreviation: 'SZS' },
    { name: '晋中市', abbreviation: 'JZS' },
    { name: '运城市', abbreviation: 'YCS' },
    { name: '忻州市', abbreviation: 'XZS' },
    { name: '临汾市', abbreviation: 'LFS' },
    { name: '吕梁市', abbreviation: 'LLS' },
  ],
  '内蒙古自治区': [
    { name: '呼和浩特市', abbreviation: 'HHHTS' },
    { name: '包头市', abbreviation: 'BTS' },
    { name: '乌海市', abbreviation: 'WHS' },
    { name: '赤峰市', abbreviation: 'CFS' },
    { name: '通辽市', abbreviation: 'TLS' },
    { name: '鄂尔多斯市', abbreviation: 'EEDSS' },
    { name: '呼伦贝尔市', abbreviation: 'HLBES' },
    { name: '巴彦淖尔市', abbreviation: 'BYNES' },
    { name: '乌兰察布市', abbreviation: 'WLCBS' },
  ],
  '辽宁省': [
    { name: '沈阳市', abbreviation: 'SYS' },
    { name: '大连市', abbreviation: 'DLS' },
    { name: '鞍山市', abbreviation: 'ASS' },
    { name: '抚顺市', abbreviation: 'FSS' },
    { name: '本溪市', abbreviation: 'BXS' },
    { name: '丹东市', abbreviation: 'DDS' },
    { name: '锦州市', abbreviation: 'JZS' },
    { name: '营口市', abbreviation: 'YKS' },
    { name: '阜新市', abbreviation: 'FXS' },
    { name: '辽阳市', abbreviation: 'LYS' },
    { name: '盘锦市', abbreviation: 'PJS' },
    { name: '铁岭市', abbreviation: 'TLS' },
    { name: '朝阳市', abbreviation: 'CYS' },
    { name: '葫芦岛市', abbreviation: 'HLDS' },
  ],
  '吉林省': [
    { name: '长春市', abbreviation: 'CCS' },
    { name: '吉林市', abbreviation: 'JLS' },
    { name: '四平市', abbreviation: 'SPS' },
    { name: '辽源市', abbreviation: 'LYS' },
    { name: '通化市', abbreviation: 'THS' },
    { name: '白山市', abbreviation: 'BSS' },
    { name: '松原市', abbreviation: 'SYS' },
    { name: '白城市', abbreviation: 'BCS' },
  ],
  '黑龙江省': [
    { name: '哈尔滨市', abbreviation: 'HEBS' },
    { name: '齐齐哈尔市', abbreviation: 'QQHES' },
    { name: '鸡西市', abbreviation: 'JXS' },
    { name: '鹤岗市', abbreviation: 'HGS' },
    { name: '双鸭山市', abbreviation: 'SYSS' },
    { name: '大庆市', abbreviation: 'DQS' },
    { name: '伊春市', abbreviation: 'YCS' },
    { name: '佳木斯市', abbreviation: 'JMSS' },
    { name: '七台河市', abbreviation: 'QTHS' },
    { name: '牡丹江市', abbreviation: 'MDJS' },
    { name: '黑河市', abbreviation: 'HHS' },
    { name: '绥化市', abbreviation: 'SHS' },
  ],
  '上海市': [
    { name: '黄浦区', abbreviation: 'HPQ' },
    { name: '徐汇区', abbreviation: 'XHQ' },
    { name: '长宁区', abbreviation: 'CNQ' },
    { name: '静安区', abbreviation: 'JAQ' },
    { name: '普陀区', abbreviation: 'PTQ' },
    { name: '虹口区', abbreviation: 'HKQ' },
    { name: '杨浦区', abbreviation: 'YPQ' },
    { name: '闵行区', abbreviation: 'MHQ' },
    { name: '宝山区', abbreviation: 'BSQ' },
    { name: '嘉定区', abbreviation: 'JDQ' },
    { name: '浦东新区', abbreviation: 'PDXQ' },
    { name: '金山区', abbreviation: 'JSQ' },
    { name: '松江区', abbreviation: 'SJQ' },
    { name: '青浦区', abbreviation: 'QPQ' },
    { name: '奉贤区', abbreviation: 'FXQ' },
    { name: '崇明区', abbreviation: 'CMQ' },
  ],
  '江苏省': [
    { 
      name: '南京市', abbreviation: 'NJS',
      districts: [
        { name: '玄武区', abbreviation: 'XWQ' },
        { name: '秦淮区', abbreviation: 'QHQ' },
        { name: '建邺区', abbreviation: 'JYQ' },
        { name: '鼓楼区', abbreviation: 'GLQ' },
        { name: '浦口区', abbreviation: 'PKQ' },
        { name: '栖霞区', abbreviation: 'QXQ' },
        { name: '雨花台区', abbreviation: 'YHTQ' },
        { name: '江宁区', abbreviation: 'JNQ' },
        { name: '六合区', abbreviation: 'LHQ' },
        { name: '溧水区', abbreviation: 'LSQ' },
        { name: '高淳区', abbreviation: 'GCQ' },
      ]
    },
    { 
      name: '无锡市', abbreviation: 'WXS',
      districts: [
        { name: '锡山区', abbreviation: 'XSQ' },
        { name: '惠山区', abbreviation: 'HSQ' },
        { name: '滨湖区', abbreviation: 'BHQ' },
        { name: '梁溪区', abbreviation: 'LXQ' },
        { name: '新吴区', abbreviation: 'XWQ' },
        { name: '江阴市', abbreviation: 'JYS' },
        { name: '宜兴市', abbreviation: 'YXS' },
      ]
    },
    { 
      name: '徐州市', abbreviation: 'XZS',
      districts: [
        { name: '鼓楼区', abbreviation: 'GLQ' },
        { name: '云龙区', abbreviation: 'YLQ' },
        { name: '贾汪区', abbreviation: 'JWQ' },
        { name: '泉山区', abbreviation: 'QSQ' },
        { name: '铜山区', abbreviation: 'TSQ' },
        { name: '丰县', abbreviation: 'FX' },
        { name: '沛县', abbreviation: 'PX' },
        { name: '睢宁县', abbreviation: 'SNX' },
        { name: '新沂市', abbreviation: 'XYS' },
        { name: '邳州市', abbreviation: 'PZS' },
      ]
    },
    { 
      name: '常州市', abbreviation: 'CZS',
      districts: [
        { name: '天宁区', abbreviation: 'TNQ' },
        { name: '钟楼区', abbreviation: 'ZLQ' },
        { name: '新北区', abbreviation: 'XBQ' },
        { name: '武进区', abbreviation: 'WJQ' },
        { name: '金坛区', abbreviation: 'JTQ' },
        { name: '溧阳市', abbreviation: 'LYS' },
      ]
    },
    { 
      name: '苏州市', abbreviation: 'SZS',
      districts: [
        { name: '虎丘区', abbreviation: 'HQQ' },
        { name: '吴中区', abbreviation: 'WZQ' },
        { name: '相城区', abbreviation: 'XCQ' },
        { name: '姑苏区', abbreviation: 'GSQ' },
        { name: '吴江区', abbreviation: 'WJQ' },
        { name: '常熟市', abbreviation: 'CSS' },
        { name: '张家港市', abbreviation: 'ZJGS' },
        { name: '昆山市', abbreviation: 'KSS' },
        { name: '太仓市', abbreviation: 'TCS' },
      ]
    },
    { name: '南通市', abbreviation: 'NTS' },
    { name: '连云港市', abbreviation: 'LYGS' },
    { name: '淮安市', abbreviation: 'HAS' },
    { name: '盐城市', abbreviation: 'YCS' },
    { name: '扬州市', abbreviation: 'YZS' },
    { name: '镇江市', abbreviation: 'ZJS' },
    { name: '泰州市', abbreviation: 'TZS' },
    { name: '宿迁市', abbreviation: 'SQS' },
  ],
  '浙江省': [
    { 
      name: '杭州市', abbreviation: 'HZS',
      districts: [
        { name: '上城区', abbreviation: 'SCQ' },
        { name: '拱墅区', abbreviation: 'GSQ' },
        { name: '西湖区', abbreviation: 'XHQ' },
        { name: '滨江区', abbreviation: 'BJQ' },
        { name: '萧山区', abbreviation: 'XSQ' },
        { name: '余杭区', abbreviation: 'YHQ' },
        { name: '富阳区', abbreviation: 'FYQ' },
        { name: '临安区', abbreviation: 'LAQ' },
        { name: '临平区', abbreviation: 'LPQ' },
        { name: '钱塘区', abbreviation: 'QTQ' },
        { name: '桐庐县', abbreviation: 'TLX' },
        { name: '淳安县', abbreviation: 'CAX' },
        { name: '建德市', abbreviation: 'JDS' },
      ]
    },
    { 
      name: '宁波市', abbreviation: 'NBS',
      districts: [
        { name: '海曙区', abbreviation: 'HSQ' },
        { name: '江北区', abbreviation: 'JBQ' },
        { name: '北仑区', abbreviation: 'BLQ' },
        { name: '镇海区', abbreviation: 'ZHQ' },
        { name: '鄞州区', abbreviation: 'YZQ' },
        { name: '奉化区', abbreviation: 'FHQ' },
        { name: '余姚市', abbreviation: 'YYS' },
        { name: '慈溪市', abbreviation: 'CXS' },
        { name: '象山县', abbreviation: 'XAX' },
        { name: '宁海县', abbreviation: 'NHX' },
      ]
    },
    { 
      name: '温州市', abbreviation: 'WZS',
      districts: [
        { name: '鹿城区', abbreviation: 'LCQ' },
        { name: '龙湾区', abbreviation: 'LWQ' },
        { name: '瓯海区', abbreviation: 'OHQ' },
        { name: '洞头区', abbreviation: 'DTQ' },
        { name: '永嘉县', abbreviation: 'YJX' },
        { name: '平阳县', abbreviation: 'PYX' },
        { name: '苍南县', abbreviation: 'CNX' },
        { name: '文成县', abbreviation: 'WCX' },
        { name: '泰顺县', abbreviation: 'TSX' },
        { name: '瑞安市', abbreviation: 'RAS' },
        { name: '乐清市', abbreviation: 'LQS' },
        { name: '龙港市', abbreviation: 'LGS' },
      ]
    },
    { name: '嘉兴市', abbreviation: 'JXS' },
    { name: '湖州市', abbreviation: 'HZS' },
    { name: '绍兴市', abbreviation: 'SXS' },
    { name: '金华市', abbreviation: 'JHS' },
    { name: '衢州市', abbreviation: 'QZS' },
    { name: '舟山市', abbreviation: 'ZSS' },
    { name: '台州市', abbreviation: 'TZS' },
    { name: '丽水市', abbreviation: 'LSS' },
  ],
  '安徽省': [
    { name: '合肥市', abbreviation: 'HFS' },
    { name: '芜湖市', abbreviation: 'WHS' },
    { name: '蚌埠市', abbreviation: 'BBS' },
    { name: '淮南市', abbreviation: 'HNS' },
    { name: '马鞍山市', abbreviation: 'MASS' },
    { name: '淮北市', abbreviation: 'HBS' },
    { name: '铜陵市', abbreviation: 'TLS' },
    { name: '安庆市', abbreviation: 'AQS' },
    { name: '黄山市', abbreviation: 'HSS' },
    { name: '滁州市', abbreviation: 'CZS' },
    { name: '阜阳市', abbreviation: 'FYS' },
    { name: '宿州市', abbreviation: 'SZS' },
    { name: '六安市', abbreviation: 'LAS' },
    { name: '亳州市', abbreviation: 'BZS' },
    { name: '池州市', abbreviation: 'CZS' },
    { name: '宣城市', abbreviation: 'XCS' },
  ],
  '福建省': [
    { 
      name: '福州市', abbreviation: 'FZS',
      districts: [
        { name: '鼓楼区', abbreviation: 'GLQ' },
        { name: '台江区', abbreviation: 'TJQ' },
        { name: '仓山区', abbreviation: 'CSQ' },
        { name: '马尾区', abbreviation: 'MWQ' },
        { name: '晋安区', abbreviation: 'JAQ' },
        { name: '长乐区', abbreviation: 'CLQ' },
        { name: '闽侯县', abbreviation: 'MHX' },
        { name: '连江县', abbreviation: 'LJX' },
        { name: '罗源县', abbreviation: 'LYX' },
        { name: '闽清县', abbreviation: 'MQX' },
        { name: '永泰县', abbreviation: 'YTX' },
        { name: '平潭县', abbreviation: 'PTX' },
        { name: '福清市', abbreviation: 'FQS' },
      ]
    },
    { 
      name: '厦门市', abbreviation: 'XMS',
      districts: [
        { name: '思明区', abbreviation: 'SMQ' },
        { name: '海沧区', abbreviation: 'HCQ' },
        { name: '湖里区', abbreviation: 'HLQ' },
        { name: '集美区', abbreviation: 'JMQ' },
        { name: '同安区', abbreviation: 'TAQ' },
        { name: '翔安区', abbreviation: 'XAQ' },
      ]
    },
    { name: '莆田市', abbreviation: 'PTS' },
    { name: '三明市', abbreviation: 'SMS' },
    { name: '泉州市', abbreviation: 'QZS' },
    { name: '漳州市', abbreviation: 'ZZS' },
    { name: '南平市', abbreviation: 'NPS' },
    { name: '龙岩市', abbreviation: 'LYS' },
    { name: '宁德市', abbreviation: 'NDS' },
  ],
  '江西省': [
    { name: '南昌市', abbreviation: 'NCS' },
    { name: '景德镇市', abbreviation: 'JDZS' },
    { name: '萍乡市', abbreviation: 'PXS' },
    { name: '九江市', abbreviation: 'JJS' },
    { name: '新余市', abbreviation: 'XYS' },
    { name: '鹰潭市', abbreviation: 'YTS' },
    { name: '赣州市', abbreviation: 'GZS' },
    { name: '吉安市', abbreviation: 'JAS' },
    { name: '宜春市', abbreviation: 'YCS' },
    { name: '抚州市', abbreviation: 'FZS' },
    { name: '上饶市', abbreviation: 'SRS' },
  ],
  '山东省': [
    { 
      name: '济南市', abbreviation: 'JNS',
      districts: [
        { name: '历下区', abbreviation: 'LXQ' },
        { name: '市中区', abbreviation: 'SZQ' },
        { name: '槐荫区', abbreviation: 'HYQ' },
        { name: '天桥区', abbreviation: 'TQQ' },
        { name: '历城区', abbreviation: 'LCQ' },
        { name: '长清区', abbreviation: 'CQQ' },
        { name: '章丘区', abbreviation: 'ZQQ' },
        { name: '济阳区', abbreviation: 'JYQ' },
        { name: '莱芜区', abbreviation: 'LWQ' },
        { name: '钢城区', abbreviation: 'GCQ' },
        { name: '平阴县', abbreviation: 'PYX' },
        { name: '商河县', abbreviation: 'SHX' },
      ]
    },
    { 
      name: '青岛市', abbreviation: 'QDS',
      districts: [
        { name: '市南区', abbreviation: 'SNQ' },
        { name: '市北区', abbreviation: 'SBQ' },
        { name: '黄岛区', abbreviation: 'HDQ' },
        { name: '崂山区', abbreviation: 'LSQ' },
        { name: '李沧区', abbreviation: 'LCQ' },
        { name: '城阳区', abbreviation: 'CYQ' },
        { name: '即墨区', abbreviation: 'JMQ' },
        { name: '胶州市', abbreviation: 'JZS' },
        { name: '平度市', abbreviation: 'PDS' },
        { name: '莱西市', abbreviation: 'LXS' },
      ]
    },
    { name: '淄博市', abbreviation: 'ZBS' },
    { name: '枣庄市', abbreviation: 'ZZS' },
    { name: '东营市', abbreviation: 'DYS' },
    { name: '烟台市', abbreviation: 'YTS' },
    { name: '潍坊市', abbreviation: 'WFS' },
    { name: '济宁市', abbreviation: 'JNS' },
    { name: '泰安市', abbreviation: 'TAS' },
    { name: '威海市', abbreviation: 'WHS' },
    { name: '日照市', abbreviation: 'RZS' },
    { name: '临沂市', abbreviation: 'LYS' },
    { name: '德州市', abbreviation: 'DZS' },
    { name: '聊城市', abbreviation: 'LCS' },
    { name: '滨州市', abbreviation: 'BZS' },
    { name: '菏泽市', abbreviation: 'HZS' },
  ],
  '河南省': [
    { 
      name: '郑州市', abbreviation: 'ZZS',
      districts: [
        { name: '中原区', abbreviation: 'ZYQ' },
        { name: '二七区', abbreviation: 'EQQ' },
        { name: '管城回族区', abbreviation: 'GCHZQ' },
        { name: '金水区', abbreviation: 'JSQ' },
        { name: '上街区', abbreviation: 'SJQ' },
        { name: '惠济区', abbreviation: 'HJQ' },
        { name: '中牟县', abbreviation: 'ZMX' },
        { name: '巩义市', abbreviation: 'GYS' },
        { name: '荥阳市', abbreviation: 'XYS' },
        { name: '新密市', abbreviation: 'XMS' },
        { name: '新郑市', abbreviation: 'XZS' },
        { name: '登封市', abbreviation: 'DFS' },
      ]
    },
    { name: '开封市', abbreviation: 'KFS' },
    { name: '洛阳市', abbreviation: 'LYS' },
    { name: '平顶山市', abbreviation: 'PDSS' },
    { name: '安阳市', abbreviation: 'AYS' },
    { name: '鹤壁市', abbreviation: 'HBS' },
    { name: '新乡市', abbreviation: 'XXS' },
    { name: '焦作市', abbreviation: 'JZS' },
    { name: '濮阳市', abbreviation: 'PYS' },
    { name: '许昌市', abbreviation: 'XCS' },
    { name: '漯河市', abbreviation: 'LHS' },
    { name: '三门峡市', abbreviation: 'SMXS' },
    { name: '南阳市', abbreviation: 'NYS' },
    { name: '商丘市', abbreviation: 'SQS' },
    { name: '信阳市', abbreviation: 'XYS' },
    { name: '周口市', abbreviation: 'ZKS' },
    { name: '驻马店市', abbreviation: 'ZMDS' },
  ],
  '湖北省': [
    { 
      name: '武汉市', abbreviation: 'WHS',
      districts: [
        { name: '江岸区', abbreviation: 'JAQ' },
        { name: '江汉区', abbreviation: 'JHQ' },
        { name: '硚口区', abbreviation: 'QKQ' },
        { name: '汉阳区', abbreviation: 'HYQ' },
        { name: '武昌区', abbreviation: 'WCQ' },
        { name: '青山区', abbreviation: 'QSQ' },
        { name: '洪山区', abbreviation: 'HSQ' },
        { name: '东西湖区', abbreviation: 'DXHQ' },
        { name: '汉南区', abbreviation: 'HNQ' },
        { name: '蔡甸区', abbreviation: 'CDQ' },
        { name: '江夏区', abbreviation: 'JXQ' },
        { name: '黄陂区', abbreviation: 'HPQ' },
        { name: '新洲区', abbreviation: 'XZQ' },
      ]
    },
    { 
      name: '黄石市', abbreviation: 'HSS',
      districts: [
        { name: '黄石港区', abbreviation: 'HSGQ' },
        { name: '西塞山区', abbreviation: 'XSSQ' },
        { name: '下陆区', abbreviation: 'XLQ' },
        { name: '铁山区', abbreviation: 'TSQ' },
        { name: '阳新县', abbreviation: 'YXX' },
        { name: '大冶市', abbreviation: 'DYS' },
      ]
    },
    { 
      name: '十堰市', abbreviation: 'SYS',
      districts: [
        { name: '茅箭区', abbreviation: 'MJQ' },
        { name: '张湾区', abbreviation: 'ZWQ' },
        { name: '郧阳区', abbreviation: 'YYQ' },
        { name: '郧西县', abbreviation: 'YXX' },
        { name: '竹山县', abbreviation: 'ZSX' },
        { name: '竹溪县', abbreviation: 'ZXX' },
        { name: '房县', abbreviation: 'FX' },
        { name: '丹江口市', abbreviation: 'DJKS' },
      ]
    },
    { 
      name: '宜昌市', abbreviation: 'YCS',
      districts: [
        { name: '西陵区', abbreviation: 'XLQ' },
        { name: '伍家岗区', abbreviation: 'WJGQ' },
        { name: '点军区', abbreviation: 'DJQ' },
        { name: '猇亭区', abbreviation: 'XTQ' },
        { name: '夷陵区', abbreviation: 'YLQ' },
        { name: '远安县', abbreviation: 'YAX' },
        { name: '兴山县', abbreviation: 'XSX' },
        { name: '秭归县', abbreviation: 'ZGX' },
        { name: '长阳土家族自治县', abbreviation: 'CYTJZZZX' },
        { name: '五峰土家族自治县', abbreviation: 'WFTJZZZX' },
        { name: '宜都市', abbreviation: 'YDS' },
        { name: '当阳市', abbreviation: 'DYS' },
        { name: '枝江市', abbreviation: 'ZJS' },
      ]
    },
    { 
      name: '襄阳市', abbreviation: 'XYS',
      districts: [
        { name: '襄城区', abbreviation: 'XCQ' },
        { name: '樊城区', abbreviation: 'FCQ' },
        { name: '襄州区', abbreviation: 'XZQ' },
        { name: '南漳县', abbreviation: 'NZX' },
        { name: '谷城县', abbreviation: 'GCX' },
        { name: '保康县', abbreviation: 'BKX' },
        { name: '老河口市', abbreviation: 'LHKS' },
        { name: '枣阳市', abbreviation: 'ZYS' },
        { name: '宜城市', abbreviation: 'YCS' },
      ]
    },
    { name: '鄂州市', abbreviation: 'EZS' },
    { name: '荆门市', abbreviation: 'JMS' },
    { name: '孝感市', abbreviation: 'XGS' },
    { name: '荆州市', abbreviation: 'JZS' },
    { name: '黄冈市', abbreviation: 'HGS' },
    { name: '咸宁市', abbreviation: 'XNS' },
    { name: '随州市', abbreviation: 'SZS' },
  ],
  '湖南省': [
    { 
      name: '长沙市', abbreviation: 'CSS',
      districts: [
        { name: '芙蓉区', abbreviation: 'FRQ' },
        { name: '天心区', abbreviation: 'TXQ' },
        { name: '岳麓区', abbreviation: 'YLQ' },
        { name: '开福区', abbreviation: 'KFQ' },
        { name: '雨花区', abbreviation: 'YHQ' },
        { name: '望城区', abbreviation: 'WCQ' },
        { name: '长沙县', abbreviation: 'CSX' },
        { name: '浏阳市', abbreviation: 'LYS' },
        { name: '宁乡市', abbreviation: 'NXS' },
      ]
    },
    { name: '株洲市', abbreviation: 'ZZS' },
    { name: '湘潭市', abbreviation: 'XTS' },
    { name: '衡阳市', abbreviation: 'HYS' },
    { name: '邵阳市', abbreviation: 'SYS' },
    { name: '岳阳市', abbreviation: 'YYS' },
    { name: '常德市', abbreviation: 'CDS' },
    { name: '张家界市', abbreviation: 'ZJJS' },
    { name: '益阳市', abbreviation: 'YYS' },
    { name: '郴州市', abbreviation: 'CZS' },
    { name: '永州市', abbreviation: 'YZS' },
    { name: '怀化市', abbreviation: 'HHS' },
    { name: '娄底市', abbreviation: 'LDS' },
  ],
  '广东省': [
    { 
      name: '广州市', abbreviation: 'GZS',
      districts: [
        { name: '荔湾区', abbreviation: 'LWQ' },
        { name: '越秀区', abbreviation: 'YXQ' },
        { name: '海珠区', abbreviation: 'HZQ' },
        { name: '天河区', abbreviation: 'THQ' },
        { name: '白云区', abbreviation: 'BYQ' },
        { name: '黄埔区', abbreviation: 'HPQ' },
        { name: '番禺区', abbreviation: 'FYQ' },
        { name: '花都区', abbreviation: 'HDQ' },
        { name: '南沙区', abbreviation: 'NSQ' },
        { name: '从化区', abbreviation: 'CHQ' },
        { name: '增城区', abbreviation: 'ZCQ' },
      ]
    },
    { 
      name: '深圳市', abbreviation: 'SZS',
      districts: [
        { name: '罗湖区', abbreviation: 'LHQ' },
        { name: '福田区', abbreviation: 'FTQ' },
        { name: '南山区', abbreviation: 'NSQ' },
        { name: '宝安区', abbreviation: 'BAQ' },
        { name: '龙岗区', abbreviation: 'LGQ' },
        { name: '盐田区', abbreviation: 'YTQ' },
        { name: '龙华区', abbreviation: 'LHQ' },
        { name: '坪山区', abbreviation: 'PSQ' },
        { name: '光明区', abbreviation: 'GMQ' },
      ]
    },
    { 
      name: '珠海市', abbreviation: 'ZHS',
      districts: [
        { name: '香洲区', abbreviation: 'XZQ' },
        { name: '斗门区', abbreviation: 'DMQ' },
        { name: '金湾区', abbreviation: 'JWQ' },
      ]
    },
    { name: '汕头市', abbreviation: 'STS' },
    { name: '佛山市', abbreviation: 'FSS' },
    { name: '江门市', abbreviation: 'JMS' },
    { name: '湛江市', abbreviation: 'ZJS' },
    { name: '茂名市', abbreviation: 'MMS' },
    { name: '肇庆市', abbreviation: 'ZQS' },
    { name: '惠州市', abbreviation: 'HZS' },
    { name: '梅州市', abbreviation: 'MZS' },
    { name: '汕尾市', abbreviation: 'SWS' },
    { name: '河源市', abbreviation: 'HYS' },
    { name: '阳江市', abbreviation: 'YJS' },
    { name: '清远市', abbreviation: 'QYS' },
    { name: '东莞市', abbreviation: 'DGS' },
    { name: '中山市', abbreviation: 'ZSS' },
    { name: '潮州市', abbreviation: 'CZS' },
    { name: '揭阳市', abbreviation: 'JYS' },
    { name: '云浮市', abbreviation: 'YFS' },
  ],
  '广西壮族自治区': [
    { name: '南宁市', abbreviation: 'NNS' },
    { name: '柳州市', abbreviation: 'LZS' },
    { name: '桂林市', abbreviation: 'GLS' },
    { name: '梧州市', abbreviation: 'WZS' },
    { name: '北海市', abbreviation: 'BHS' },
    { name: '防城港市', abbreviation: 'FCGS' },
    { name: '钦州市', abbreviation: 'QZS' },
    { name: '贵港市', abbreviation: 'GGS' },
    { name: '玉林市', abbreviation: 'YLS' },
    { name: '百色市', abbreviation: 'BSS' },
    { name: '贺州市', abbreviation: 'HZS' },
    { name: '河池市', abbreviation: 'HCS' },
    { name: '来宾市', abbreviation: 'LBS' },
    { name: '崇左市', abbreviation: 'CZS' },
  ],
  '海南省': [
    { name: '海口市', abbreviation: 'HKS' },
    { name: '三亚市', abbreviation: 'SYS' },
    { name: '三沙市', abbreviation: 'SSS' },
    { name: '儋州市', abbreviation: 'DZS' },
  ],
  '重庆市': [
    { name: '万州区', abbreviation: 'WZQ' },
    { name: '涪陵区', abbreviation: 'FLQ' },
    { name: '渝中区', abbreviation: 'YZQ' },
    { name: '大渡口区', abbreviation: 'DDKQ' },
    { name: '江北区', abbreviation: 'JBQ' },
    { name: '沙坪坝区', abbreviation: 'SPBQ' },
    { name: '九龙坡区', abbreviation: 'JLPQ' },
    { name: '南岸区', abbreviation: 'NAQ' },
    { name: '北碚区', abbreviation: 'BBQ' },
    { name: '渝北区', abbreviation: 'YBQ' },
    { name: '巴南区', abbreviation: 'BNQ' },
    { name: '黔江区', abbreviation: 'QJQ' },
    { name: '长寿区', abbreviation: 'CSQ' },
    { name: '江津区', abbreviation: 'JJQ' },
    { name: '合川区', abbreviation: 'HCQ' },
    { name: '永川区', abbreviation: 'YCQ' },
    { name: '南川区', abbreviation: 'NCQ' },
    { name: '璧山区', abbreviation: 'BSQ' },
    { name: '铜梁区', abbreviation: 'TLQ' },
    { name: '潼南区', abbreviation: 'TNQ' },
    { name: '荣昌区', abbreviation: 'RCQ' },
    { name: '开州区', abbreviation: 'KZQ' },
    { name: '梁平区', abbreviation: 'LPQ' },
    { name: '武隆区', abbreviation: 'WLQ' },
  ],
  '四川省': [
    { 
      name: '成都市', abbreviation: 'CDS',
      districts: [
        { name: '锦江区', abbreviation: 'JJQ' },
        { name: '青羊区', abbreviation: 'QYQ' },
        { name: '金牛区', abbreviation: 'JNQ' },
        { name: '武侯区', abbreviation: 'WHQ' },
        { name: '成华区', abbreviation: 'CHQ' },
        { name: '龙泉驿区', abbreviation: 'LQYQ' },
        { name: '青白江区', abbreviation: 'QBJQ' },
        { name: '新都区', abbreviation: 'XDQ' },
        { name: '温江区', abbreviation: 'WJQ' },
        { name: '双流区', abbreviation: 'SLQ' },
        { name: '郫都区', abbreviation: 'PDQ' },
        { name: '新津区', abbreviation: 'XJQ' },
        { name: '金堂县', abbreviation: 'JTX' },
        { name: '大邑县', abbreviation: 'DYX' },
        { name: '蒲江县', abbreviation: 'PJX' },
        { name: '都江堰市', abbreviation: 'DJYS' },
        { name: '彭州市', abbreviation: 'PZS' },
        { name: '邛崃市', abbreviation: 'QLS' },
        { name: '崇州市', abbreviation: 'CZS' },
        { name: '简阳市', abbreviation: 'JYS' },
      ]
    },
    { name: '自贡市', abbreviation: 'ZGS' },
    { name: '攀枝花市', abbreviation: 'PZHS' },
    { name: '泸州市', abbreviation: 'LZS' },
    { name: '德阳市', abbreviation: 'DYS' },
    { name: '绵阳市', abbreviation: 'MYS' },
    { name: '广元市', abbreviation: 'GYS' },
    { name: '遂宁市', abbreviation: 'SNS' },
    { name: '内江市', abbreviation: 'NJS' },
    { name: '乐山市', abbreviation: 'LSS' },
    { name: '南充市', abbreviation: 'NCS' },
    { name: '眉山市', abbreviation: 'MSS' },
    { name: '宜宾市', abbreviation: 'YBS' },
    { name: '广安市', abbreviation: 'GAS' },
    { name: '达州市', abbreviation: 'DZS' },
    { name: '雅安市', abbreviation: 'YAS' },
    { name: '巴中市', abbreviation: 'BZS' },
    { name: '资阳市', abbreviation: 'ZYS' },
  ],
  '贵州省': [
    { name: '贵阳市', abbreviation: 'GYS' },
    { name: '六盘水市', abbreviation: 'LPSS' },
    { name: '遵义市', abbreviation: 'ZYS' },
    { name: '安顺市', abbreviation: 'ASS' },
    { name: '毕节市', abbreviation: 'BJS' },
    { name: '铜仁市', abbreviation: 'TRS' },
  ],
  '云南省': [
    { 
      name: '昆明市', abbreviation: 'KMS',
      districts: [
        { name: '五华区', abbreviation: 'WHQ' },
        { name: '盘龙区', abbreviation: 'PLQ' },
        { name: '官渡区', abbreviation: 'GDQ' },
        { name: '西山区', abbreviation: 'XSQ' },
        { name: '东川区', abbreviation: 'DCQ' },
        { name: '呈贡区', abbreviation: 'CGQ' },
        { name: '晋宁区', abbreviation: 'JNQ' },
        { name: '富民县', abbreviation: 'FMX' },
        { name: '宜良县', abbreviation: 'YLX' },
        { name: '石林彝族自治县', abbreviation: 'SLYZZZX' },
        { name: '嵩明县', abbreviation: 'SMX' },
        { name: '禄劝彝族苗族自治县', abbreviation: 'LQYZMZZZX' },
        { name: '寻甸回族彝族自治县', abbreviation: 'XDHZYZZZX' },
        { name: '安宁市', abbreviation: 'ANS' },
      ]
    },
    { name: '曲靖市', abbreviation: 'QJS' },
    { name: '玉溪市', abbreviation: 'YXS' },
    { name: '保山市', abbreviation: 'BSS' },
    { name: '昭通市', abbreviation: 'ZTS' },
    { name: '丽江市', abbreviation: 'LJS' },
    { name: '普洱市', abbreviation: 'PES' },
    { name: '临沧市', abbreviation: 'LCS' },
  ],
  '西藏自治区': [
    { name: '拉萨市', abbreviation: 'LSS' },
    { name: '日喀则市', abbreviation: 'RKZS' },
    { name: '昌都市', abbreviation: 'CDS' },
    { name: '林芝市', abbreviation: 'LZS' },
    { name: '山南市', abbreviation: 'SNS' },
    { name: '那曲市', abbreviation: 'NQS' },
  ],
  '陕西省': [
    { 
      name: '西安市', abbreviation: 'XAS',
      districts: [
        { name: '新城区', abbreviation: 'XCQ' },
        { name: '碑林区', abbreviation: 'BLQ' },
        { name: '莲湖区', abbreviation: 'LHQ' },
        { name: '灞桥区', abbreviation: 'BQQ' },
        { name: '未央区', abbreviation: 'WYQ' },
        { name: '雁塔区', abbreviation: 'YTQ' },
        { name: '阎良区', abbreviation: 'YLQ' },
        { name: '临潼区', abbreviation: 'LTQ' },
        { name: '长安区', abbreviation: 'CAQ' },
        { name: '高陵区', abbreviation: 'GLQ' },
        { name: '鄠邑区', abbreviation: 'HYQ' },
        { name: '蓝田县', abbreviation: 'LTX' },
        { name: '周至县', abbreviation: 'ZZX' },
      ]
    },
    { name: '铜川市', abbreviation: 'TCS' },
    { name: '宝鸡市', abbreviation: 'BJS' },
    { name: '咸阳市', abbreviation: 'XYS' },
    { name: '渭南市', abbreviation: 'WNS' },
    { name: '延安市', abbreviation: 'YAS' },
    { name: '汉中市', abbreviation: 'HZS' },
    { name: '榆林市', abbreviation: 'YLS' },
    { name: '安康市', abbreviation: 'AKS' },
    { name: '商洛市', abbreviation: 'SLS' },
  ],
  '甘肃省': [
    { name: '兰州市', abbreviation: 'LZS' },
    { name: '嘉峪关市', abbreviation: 'JYGS' },
    { name: '金昌市', abbreviation: 'JCS' },
    { name: '白银市', abbreviation: 'BYS' },
    { name: '天水市', abbreviation: 'TSS' },
    { name: '武威市', abbreviation: 'WWS' },
    { name: '张掖市', abbreviation: 'ZYS' },
    { name: '平凉市', abbreviation: 'PLS' },
    { name: '酒泉市', abbreviation: 'JQS' },
    { name: '庆阳市', abbreviation: 'QYS' },
    { name: '定西市', abbreviation: 'DXS' },
    { name: '陇南市', abbreviation: 'LNS' },
  ],
  '青海省': [
    { name: '西宁市', abbreviation: 'XNS' },
    { name: '海东市', abbreviation: 'HDS' },
  ],
  '宁夏回族自治区': [
    { name: '银川市', abbreviation: 'YCS' },
    { name: '石嘴山市', abbreviation: 'SZSS' },
    { name: '吴忠市', abbreviation: 'WZS' },
    { name: '固原市', abbreviation: 'GYS' },
    { name: '中卫市', abbreviation: 'ZWS' },
  ],
  '新疆维吾尔自治区': [
    { name: '乌鲁木齐市', abbreviation: 'WLMQS' },
    { name: '克拉玛依市', abbreviation: 'KLMYS' },
    { name: '吐鲁番市', abbreviation: 'TLFS' },
    { name: '哈密市', abbreviation: 'HMS' },
  ],
  '台湾省': [
    { name: '台北市', abbreviation: 'TBS' },
    { name: '高雄市', abbreviation: 'GXS' },
    { name: '基隆市', abbreviation: 'JLS' },
    { name: '台中市', abbreviation: 'TZS' },
    { name: '台南市', abbreviation: 'TNS' },
    { name: '新竹市', abbreviation: 'XZS' },
    { name: '嘉义市', abbreviation: 'JYS' },
  ],
  '香港特别行政区': [
    { name: '中西区', abbreviation: 'ZXQ' },
    { name: '湾仔区', abbreviation: 'WZQ' },
    { name: '东区', abbreviation: 'DQ' },
    { name: '南区', abbreviation: 'NQ' },
    { name: '油尖旺区', abbreviation: 'YJWQ' },
    { name: '深水埗区', abbreviation: 'SSBQ' },
    { name: '九龙城区', abbreviation: 'JLCQ' },
    { name: '黄大仙区', abbreviation: 'HDXQ' },
    { name: '观塘区', abbreviation: 'GTQ' },
    { name: '荃湾区', abbreviation: 'QWQ' },
    { name: '屯门区', abbreviation: 'TMQ' },
    { name: '元朗区', abbreviation: 'YLQ' },
    { name: '北区', abbreviation: 'BQ' },
    { name: '大埔区', abbreviation: 'DPQ' },
    { name: '西贡区', abbreviation: 'XGQ' },
    { name: '沙田区', abbreviation: 'STQ' },
    { name: '葵青区', abbreviation: 'KQQ' },
    { name: '离岛区', abbreviation: 'LDQ' },
  ],
  '澳门特别行政区': [
    { name: '花地玛堂区', abbreviation: 'HDMTQ' },
    { name: '圣安多尼堂区', abbreviation: 'SADNTQ' },
    { name: '大堂区', abbreviation: 'DTQ' },
    { name: '望德堂区', abbreviation: 'WDTQ' },
    { name: '风顺堂区', abbreviation: 'FSTQ' },
    { name: '嘉模堂区', abbreviation: 'JMTQ' },
    { name: '圣方济各堂区', abbreviation: 'SFJGTQ' },
  ],
};

// 初始化地区数据
function initRegionData(): void {
  // 添加省份
  for (const province of provinceData) {
    allRegions.push({
      name: province.name,
      abbreviation: province.abbreviation,
      level: 'province',
    });
    
    // 添加城市/区县
    const cities = cityDataByProvince[province.name] || [];
    for (const city of cities) {
      // 计算完整路径的首字母缩写（省份+城市）
      const cityFullAbbr = province.abbreviation + city.abbreviation;
      
      // 判断是否是直辖市（直辖市的城市数据实际上是区县）
      const isMunicipality = ['北京市', '天津市', '上海市', '重庆市'].includes(province.name);
      
      allRegions.push({
        name: `${province.name} - ${city.name}`,
        abbreviation: cityFullAbbr,
        level: isMunicipality ? 'district' : 'city',
        parent: province.name,
      });
      
      // 如果有区县数据，添加区县
      if (city.districts && !isMunicipality) {
        for (const district of city.districts) {
          const districtFullAbbr = cityFullAbbr + district.abbreviation;
          allRegions.push({
            name: `${province.name} - ${city.name} - ${district.name}`,
            abbreviation: districtFullAbbr,
            level: 'district',
            parent: `${province.name} - ${city.name}`,
          });
        }
      }
    }
  }
}

// 初始化
initRegionData();

/**
 * 严格首字母检索
 * 仅支持首字母检索，不支持其他搜索方式
 * 
 * @param input 用户输入的首字母
 * @returns 匹配的地区列表
 */
export function searchByFirstLetter(input: string): { value: string; label: string; matchType: string }[] {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  // 转换为大写进行匹配
  const upperInput = input.toUpperCase().trim();
  
  // 验证输入是否为纯字母
  if (!/^[A-Z]+$/.test(upperInput)) {
    return [];
  }
  
  const results: { value: string; label: string; matchType: string; sortKey: number }[] = [];
  
  for (const region of allRegions) {
    const upperAbbr = region.abbreviation.toUpperCase();
    
    // 完全匹配
    if (upperAbbr === upperInput) {
      results.push({
        value: region.name,
        label: region.name,
        matchType: '完全匹配',
        sortKey: 0,
      });
      continue;
    }
    
    // 前缀匹配
    if (upperAbbr.startsWith(upperInput)) {
      results.push({
        value: region.name,
        label: region.name,
        matchType: '前缀匹配',
        sortKey: 1,
      });
      continue;
    }
    
    // 包含匹配
    if (upperAbbr.includes(upperInput)) {
      results.push({
        value: region.name,
        label: region.name,
        matchType: '包含匹配',
        sortKey: 2,
      });
    }
  }
  
  // 按匹配类型排序，优先显示完全匹配
  results.sort((a, b) => a.sortKey - b.sortKey);
  
  return results;
}

/**
 * 验证输入是否为有效的首字母格式
 */
export function isValidFirstLetterInput(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return /^[a-zA-Z]+$/.test(input.trim());
}

/**
 * 获取所有省份列表
 */
export function getProvinceList(): { value: string; label: string; abbreviation: string }[] {
  return provinceData.map(p => ({
    value: p.name,
    label: p.name,
    abbreviation: p.abbreviation,
  }));
}

/**
 * 获取指定省份的城市列表
 */
export function getCityList(provinceName: string): { value: string; label: string; abbreviation: string }[] {
  const cities = cityDataByProvince[provinceName] || [];
  const province = provinceData.find(p => p.name === provinceName);
  const provinceAbbr = province?.abbreviation || '';
  
  return cities.map(c => ({
    value: `${provinceName} - ${c.name}`,
    label: `${provinceName} - ${c.name}`,
    abbreviation: provinceAbbr + c.abbreviation,
  }));
}

/**
 * 获取所有地区选项（用于下拉选择）
 */
export function getAllRegionOptions(): { value: string; label: string; abbreviation: string }[] {
  return allRegions.map(r => ({
    value: r.name,
    label: r.name,
    abbreviation: r.abbreviation,
  }));
}

/**
 * 搜索籍贯（仅到市级）
 * 用于籍贯字段，只返回省份和城市级别
 */
export function searchHukouByFirstLetter(input: string): { value: string; label: string; matchType: string }[] {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  const upperInput = input.toUpperCase().trim();
  
  if (!/^[A-Z]+$/.test(upperInput)) {
    return [];
  }
  
  const results: { value: string; label: string; matchType: string; sortKey: number }[] = [];
  
  for (const region of allRegions) {
    // 只包含省份和城市级别（不包含区县）
    if (region.level === 'district') continue;
    
    const upperAbbr = region.abbreviation.toUpperCase();
    
    if (upperAbbr === upperInput) {
      results.push({
        value: region.name,
        label: region.name,
        matchType: '完全匹配',
        sortKey: 0,
      });
      continue;
    }
    
    if (upperAbbr.startsWith(upperInput)) {
      results.push({
        value: region.name,
        label: region.name,
        matchType: '前缀匹配',
        sortKey: 1,
      });
      continue;
    }
    
    if (upperAbbr.includes(upperInput)) {
      results.push({
        value: region.name,
        label: region.name,
        matchType: '包含匹配',
        sortKey: 2,
      });
    }
  }
  
  results.sort((a, b) => a.sortKey - b.sortKey);
  
  return results;
}

/**
 * 搜索出生地/居留地（到区县级）
 * 用于出生地和居留地字段，返回省份、城市和区县级别
 */
export function searchBirthplaceByFirstLetter(input: string): { value: string; label: string; matchType: string }[] {
  return searchByFirstLetter(input);
}

/**
 * 解析地区名称，提取省份、城市、区县
 */
export function parseRegionName(fullName: string): { province: string; city: string; district: string } | null {
  if (!fullName) return null;
  
  const parts = fullName.split(' - ');
  
  if (parts.length === 1) {
    return { province: parts[0], city: '', district: '' };
  } else if (parts.length === 2) {
    return { province: parts[0], city: parts[1], district: '' };
  } else if (parts.length === 3) {
    return { province: parts[0], city: parts[1], district: parts[2] };
  }
  
  return null;
}

// 导出省份和城市数据供其他模块使用
export { provinceData, cityDataByProvince };
