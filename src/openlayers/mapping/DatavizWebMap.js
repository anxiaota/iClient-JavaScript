/* Copyright© 2000 - 2018 SuperMap Software Co.Ltd. All rights reserved.
 * This program are made available under the terms of the Apache License, Version 2.0
 * which accompanies this distribution and is available at http://www.apache.org/licenses/LICENSE-2.0.html.*/
import ol from 'openlayers';
import {
    FetchRequest
} from '@supermap/iclient-common';
import {
    Util
} from '../core/Util';
import {
    StyleUtils
} from '../core/StyleUtils';
ol.supermap = ol.supermap || {};
const mapInfo ={
    "extent": {
        "leftBottom": {
                "x": -20037508.3427892,
                "y": -20037508.3427892
        },
        "rightTop": {
                "x": 20037508.3427892,
                "y": 20037508.3427892
        }
    },
    "level": 1,
    "center": {
        "x": 0,
        "y": -7.081154551613622e-10
    },
    "baseLayer": {
        "layerType": "TIANDITU_VEC_3857",
        "name": "天地图",
        "visible": true
    },
    "layers": [
        {
            "dataTypes": {
                "纬度": "NUMBER",
                "经度": "NUMBER",
                "城市": "STRING",
                "站点": "STRING"
            },
            "layerType": "VECTOR",
            "visible": true,
            "name": "浙江省高等院校",
            "featureType": "POINT",
            "xyField": {
                "xField": "经度",
                "yField": "纬度"
            },
            "labelStyle": {
                "fontFamily": "微软雅黑",
                "offsetY": -20,
                "fontSize": "14px",
                "fill": "#333",
                "backgroundFill": [
                    255,
                    255,
                    255,
                    0.7
                ],
                "labelField": "城市"
            },
            "style": {
                "type": "SVG_POINT",
                "fillColor": "#ff0000",
                "strokeWidth": 0,
                "fillOpacity": 0.84,
                "radius": 9,
                "strokeColor": "#ffffff",
                "url": "http://localhost:8090/iportal/./resources/markerIcon/symbol-input87bc0f2Img.svg",
                "strokeOpacity": 1
            },
            "projection": "EPSG:4326",
            "dataSource": {
                "type": "PORTAL_DATA",
                "serverId": "2058718950"
            }
        }
    ],
        "description": "",
        "projection": "EPSG:3857",
        "title": "SymbolPoint_Label_NoFilter",
        "version": "1.0"
}

/**
 * @class ol.supermap.WebMap
 * @category  iPortal/Online
 * @classdesc 对接 iPortal/Online 地图类。
 * @param {string} id - iPortal|Online 地图 ID。
 * @param {Object} options - 参数。
 * @param {string} [options.target='map'] - 目标类型。
 * @param {ol.map} [options.map] - 地图对象。
 * @param {string} [options.server='http://www.supermapol.com'] - 服务地址。
 * @param {string} [options.credentialKey='key'] - 凭证密钥。
 * @param {string} [options.credentialValue] - 凭证值。
 * @extends {ol.Observable}
 */
export class DatavizWebMap extends ol.Observable {

    constructor(dom, url, options) {
        super();
        this.mapUrl = url;
        if(options) {
            this.callBack = options.callback;
            this.credentialKey = options.credentialKey;
            this.credentialValue = options.credentialValue;
        }
        this.createMap(dom);
        this.createWebmap();
    }

    createMap(dom) {
        //todo 地图点击事件等事件，控件配置等需要开出接口或者用时间
        this.map = new ol.Map({
            /*overlays: [
                new ol.Overlay({
                    offset: [0, -20],
                    id: 'theme-pop',
                    positioning: 'bottom-center'
                }),
                new ol.Overlay({
                    id: 'marker-pop',
                    positioning: 'bottom-center'
                })
            ],*/
            target: dom
        });
    }

    /**
     * @function ol.supermap.WebMap.prototype.load
     * @description 登陆窗口后添加地图图层。
     */
    createWebmap() {
        let mapUrl = this.mapUrl;
        if (this.credentialKey) {
            mapUrl += ('?' + this.credentialKey + '=' + this.credentialValue);
        }
        this.getMapInfo(mapUrl);
    }

    /**
     * 获取分享的地图信息
     */
    getMapInfo(url) {
       /* FetchRequest.get(`${url}.json`).then(function (response) {
            console.log(response);
        });*/
        if(mapInfo) {
            this.baseProjection = mapInfo.projection;
            this.addBaseMap(mapInfo);
            this.addLayers(mapInfo);
        }
    }
    addBaseMap(mapInfo) {
        this.createView(mapInfo);
        this.map.addLayer(this.createBaseLayer(mapInfo));
    }
    createView(options) {
        let view = this.map.getView(),
            oldcenter = options.center,
            zoom = options.level,
            extent = options.extent,
            projection = options.projection;
        //如果是坐标系转换，就把旧的view的配置读出来，做一个转换生成新的view
        /*if (view && center && zoom) {
            let oldCode = view.getProjection().getCode();
            center = view.getCenter();
            if (oldCode && oldCode !== projection) {
                center = ol.proj.transform(center, oldCode, projection);
            }
        }*/
        let center = [];
        for(let key in oldcenter) {
            center.push(oldcenter[key]);
        }
        extent = [extent.leftBottom.x, extent.leftBottom.y, extent.rightTop.x, extent.rightTop.y];
        zoom= 1;
        this.map.setView(new ol.View({ zoom, center, projection, extent }));
    }
    /**
     * Method: createLayer
     * 同步方式创建图层并返回
     * */
    createBaseLayer(mapInfo){
        let source, layerInfo = mapInfo.baseLayer;
        let layerType = layerInfo.layerType;
        if(layerType.indexOf('TIANDITU_VEC') || layerType.indexOf('TIANDITU_IMG') || layerType.indexOf('TIANDITU_TER')) {
            layerType = layerType.substr(0,12);
        }
        let mapUrls = {
            CLOUD: 'http://t2.supermapcloud.com/FileService/image?map=quanguo&type=web&x={x}&y={y}&z={z}',
            CLOUD_BLACK: 'http://t3.supermapcloud.com/MapService/getGdp?x={x}&y={y}&z={z}',
            OSM: 'http://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            GOOGLE: 'http://www.google.cn/maps/vt/pb=!1m4!1m3!1i{z}!2i{x}!3i{y}!2m3!1e0!2sm!3i380072576!3m8!2szh-CN!3scn!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m1!1e0',
            GOOGLE_CN: 'https://mt{0-3}.google.cn/vt/lyrs=m&hl=zh-CN&gl=cn&x={x}&y={y}&z={z}',
            JAPAN_STD: 'http://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
            JAPAN_PALE: 'http://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
            JAPAN_RELIEF: 'http://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png',
            JAPAN_ORT: 'http://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg'
        }, url;
        switch(layerType){
            case "TIANDITU_VEC":
            case "TIANDITU_IMG":
            case "TIANDITU_TER":
                source=this.createTiandituSource(layerInfo, layerType, mapInfo.projection);
                break;
            case "BAIDU":
                source=this.createBaiduSource();
                break;
            case 'BING':
                source = this.createBingSource(layerInfo, mapInfo.projection);
                break;
            case "WMS":
                source=this.createWMSSource(layerInfo);
                break;
            case "WMTS":
                source=this.createWmtsLayer(layerInfo);
                break;
            case 'CLOUD':
            case 'CLOUD_BLACK':
            case 'OSM':
            case 'JAPAN_ORT':
            case 'JAPAN_RELIEF':
            case 'JAPAN_PALE':
            case 'JAPAN_STD':
            case 'GOOGLE_CN':
            case 'GOOGLE':
                url = mapUrls[layerType];
                source = this.createXYZSource(layerInfo, url);
                break;
            default:
                break;
        }
        return new ol.layer.Tile({
            source: source,
            zIndex: layerInfo.zIndex || 0,
            visible: layerInfo.visible
        });
    }
    createTiandituSource(layerInfo, layerType, projection, isLabel) {
        //todo 后台存储没有存储isLabel是否有标签
        let options = {
            layerType: layerType.split('_')[1].toLowerCase(),
            isLabel: isLabel || false,
            projection: projection
        };
        return new ol.source.Tianditu(options);
    }
    createBaiduSource() {
        return new ol.source.BaiduMap()
    }
    createBingSource(layerInfo, projection) {
        let url = 'http://dynamic.t0.tiles.ditu.live.com/comp/ch/{quadKey}?it=G,TW,L,LA&mkt=zh-cn&og=109&cstl=w4c&ur=CN&n=z';
        return new ol.source.XYZ({
            wrapX: false,
            projection: projection,
            tileUrlFunction: function (coordinates) {
                let /*quadDigits = '', */[z, x, y] = [...coordinates];
                y = y > 0 ? y - 1 : -y - 1;
                var index = '';
                for (let i = z; i > 0; i--) {
                    let b = 0;
                    let mask = 1 << (i - 1);
                    if ((x & mask) !== 0) b++;
                    if ((y & mask) !== 0) b += 2;
                    index += b.toString()
                }
                return url.replace('{quadKey}', index);
            }
        })
    }
    createXYZSource(layerInfo, url) {
        return new ol.source.XYZ({
            url: url,
            wrapX: false,
            crossOrigin: window.location.host
        })
    }
    createWMSSource(layerInfo) {
        let that = this;
        return new ol.source.TileWMS({
            url: layerInfo.url,
            wrapX: false,
            params: {
                LAYERS: layerInfo.subLayers || "0",
                FORMAT: 'image/png'
            },
            projection: layerInfo.epsgCode,
            tileLoadFunction: function (imageTile, src) {
                imageTile.getImage().src = that.tileProxy + encodeURIComponent(src)
            }
        })
    }
    addLayers(mapInfo) {
        let layers = mapInfo.layers, that = this;
        if(layers.length > 0) {
            layers.forEach(function (layer) {
                if(layer.dataSource && layer.dataSource.serverId) {
                    //数据存储到iportal上了
                    let url = `${Util.getRootUrl()}web/datas/${layer.dataSource.serverId}/content.json?pageSize=9999999&currentPage=1`;
                    FetchRequest.get(url, null, {withCredentials: true}).then(function (response) {
                        return response.json()
                    }).then(function (data) {
                        if(data && data.type) {
                           let features;
                           if (!data) {
                               features = [];
                           } else if (data.type === "JSON" || data.type === "GEOJSON") {
                                console.log()
                           } else if (data.type === 'EXCEL' || data.type === 'CSV') {
                               features = that.excelData2Feature(data.content, layer);
                               that.addLayer(layer, features);
                           } 
                        }
                    })
                }
            }, this);
        }
    }
    excelData2Feature(content, layerInfo) {
        let rows = content.rows,
            colTitles = content.colTitles;
        // 解决V2恢复的数据中含有空格
        for (let i in colTitles) {
            if (Util.isString(colTitles[i])) {
                colTitles[i] = Util.trim(colTitles[i]);
            }
        }
        let fileCode = layerInfo.projection,
            xIdx = colTitles.indexOf(layerInfo.xyField.xField),
            yIdx = colTitles.indexOf(layerInfo.xyField.yField),
            baseLayerEpsgCode = this.baseProjection,
            features = [];

        for (let i = 0, len = rows.length; i < len; i++) {
            let rowDatas = rows[i],
                attributes = {},
                geomX = rows[i][xIdx],
                geomY = rows[i][yIdx];
            // 位置字段信息不存在 过滤数据
            if (geomX !== '' && geomY !== '') {
                let olGeom = new ol.geom.Point([+geomX, +geomY]);
                if (fileCode !== baseLayerEpsgCode) {
                    olGeom.transform(fileCode, baseLayerEpsgCode);
                }
                for (let j = 0, leng = rowDatas.length; j < leng; j++) {
                    attributes[colTitles[j]] = rowDatas[j];
                }
                let feature = new ol.Feature({ geometry: olGeom, Properties: attributes });
                feature.attributes = attributes;
                features.push(feature);
            }
        }
        return features;
    }
    addLayer(layerInfo, features) {
        if(layerInfo.layerType === "VECTOR") {
            if (layerInfo.featureType === "POINT") {
                this.addGraphicLayer(layerInfo, features);
            } else {
                // this.addVectorLayer(layerInfo, features);
            }
        }
    }

    /**
     * 添加大数据图层到地图上
     * @param layerInfo
     * @param features
     */
    addGraphicLayer(layerInfo, features) {
        let graphics = this.getGraphicsFromFeatures(features, layerInfo.style);
        let source = new ol.source.Graphic({
            graphics: graphics,
            render: 'canvas',
            map: this.map,
            isHighLight: false,
            onClick: function(graphic){}
        });
        let layer = new ol.layer.Image({source: source});
        this.map.addLayer(layer);
        source.refresh();
    }
    getGraphicsFromFeatures(features, style) {
        let olStyle, shape;
        if(style.type === "IMAGE_POINT") {
            //image-point
            let imageInfo = style.imageInfo;
            let imgDom = imageInfo.img;
            if(!imgDom) {
                imgDom = new Image();
                //要组装成完整的url
                imgDom.src = Util.getRootUrl() + imageInfo.url;
            }
            shape = new ol.style.Icon({
                img:  imgDom,
                scale: 2*style.radius/imageInfo.size.w,
                imgSize: [imageInfo.size.w, imageInfo.size.h],
                anchor : [0.5, 0.5]
            });
        } else if(style.type === "SVG_POINT") {

        } else {
            //base-point
            olStyle = StyleUtils.toOpenLayersStyle(style, "POINT");
            shape = olStyle.getImage();
        }
        let graphics = [];
        //构建graphic
        for(let i in features){
            let graphic = new ol.Graphic(features[i].getGeometry(), features[i].attributes);
            graphic.setStyle(shape);
            graphics.push(graphic);
        }
        return graphics;
    }
    
}

ol.supermap.DatavizWebMap = DatavizWebMap;