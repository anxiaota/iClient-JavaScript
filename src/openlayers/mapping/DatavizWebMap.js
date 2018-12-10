/* Copyright© 2000 - 2018 SuperMap Software Co.Ltd. All rights reserved.
 * This program are made available under the terms of the Apache License, Version 2.0
 * which accompanies this distribution and is available at http://www.apache.org/licenses/LICENSE-2.0.html.*/
import ol from 'openlayers';
import {
    FetchRequest,
    SecurityManager
} from '@supermap/iclient-common';
import {
    Util
} from '../core/Util';
import {
    StyleUtils
} from '../core/StyleUtils';
import {
    ColorsPickerUtil
} from '../core/colors_picker_util/ColorsPickerUtil';
import {
    ArrayStatistic
} from '../core/ArrayStatistic';

ol.supermap = ol.supermap || {};
//数据转换工具
const transformTools = new ol.format.GeoJSON();
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
        let that = this, mapUrl = `${url}.json`;
        FetchRequest.get(mapUrl, null, {withCredentials: true}).then(function (response) {
            return response.json();
        }).then(function (mapInfo) {
            that.baseProjection = mapInfo.projection; //epsgCode是之前的数据格式 todo
            that.addBaseMap(mapInfo);
            if(mapInfo.layers.length === 0) {
                that.sendMapToUser(0, mapInfo.layers.length);
            } else {
                that.addLayers(mapInfo);
            }
        });
    }
    addBaseMap(mapInfo) {
        this.createView(mapInfo);
        let layer = this.createBaseLayer(mapInfo);
        if(mapInfo.title) {
            layer.setProperties({title: mapInfo.title});
        }
        this.map.addLayer(layer);
        if(mapInfo.baseLayer && mapInfo.baseLayer.isLabel) {
            let layerInfo = mapInfo.baseLayer;
            //存在天地图路网
            let labelLayer = new ol.layer.Tile({
                source: this.createTiandituSource(layerInfo, layerInfo.layerType, mapInfo.projection, true),
                zIndex: layerInfo.zIndex || 0,
                visible: layerInfo.visible
            });
            this.map.addLayer(labelLayer);
        }
    }
    createView(options) {
        let view = this.map.getView(),
            oldcenter = options.center,
            zoom = options.level,
            extent = options.extent,
            projection = this.baseProjection;
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
        let source, layerInfo = mapInfo.baseLayer || mapInfo;
        let layerType = layerInfo.layerType; //底图和rest地图兼容
        if(layerType.indexOf('TIANDITU_VEC') > -1 || layerType.indexOf('TIANDITU_IMG') > -1
            || layerType.indexOf('TIANDITU_TER') > -1) {
            layerType = layerType.substr(0,12);
        }
        let that = this;
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
                source= this.createWMTSSource(layerInfo);
                break;
            case 'TILE':
                source = this.createDynamicTiledSource(layerInfo);
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
    /**
     * 获取supermap iServer类型的地图的source
     *
     * @param {any} layerInfo
     * @returns
     */
    createDynamicTiledSource(layerInfo) {
        let serverType = "IPORTAL",
            credential = layerInfo.credential,
            keyfix = 'Token',
            keyParams = layerInfo.url,
            projection = layerInfo.projection || this.baseProjection;
        if (layerInfo.url.indexOf("www.supermapol.com") > -1 || layerInfo.url.indexOf("itest.supermapol.com") > -1) {
            keyfix = 'Key';
            keyParams = [keyParams];
            serverType = "ONLINE";
        }
        if (credential) {
            SecurityManager[`register${keyfix}`](keyParams, credential);
        }
        let source = new ol.source.TileSuperMapRest({
            transparent: true,
            url: layerInfo.url,
            wrapX: false,
            serverType: serverType,
            prjCoordSys: { epsgCode: projection.split(':')[1] },
            tileProxy: this.tileProxy
        });
        SecurityManager[`register${keyfix}`](layerInfo.url);
        return source;

    }

    /**
     * 创建天地图的source
     * @param layerInfo 图层信息
     * @param layerType 图层类型
     * @param projection 地理坐标系
     * @param isLabel  是否有路网图层
     * @returns {ol.source.Tianditu}
     */
    createTiandituSource(layerInfo, layerType, projection, isLabel) {
        //todo 后台存储没有存储isLabel是否有标签
        let options = {
            layerType: layerType.split('_')[1].toLowerCase(),
            isLabel: isLabel || false,
            projection: projection
        };
        return new ol.source.Tianditu(options);
    }

    /**
     * 创建百度地图的source
     * @returns {ol.source.BaiduMap}
     */
    createBaiduSource() {
        return new ol.source.BaiduMap()
    }

    /**
     * 创建bing地图的source
     * @param layerInfo
     * @param projection
     * @returns {ol.source.XYZ}
     */
    createBingSource(layerInfo, projection) {
        let url = 'http://dynamic.t0.tiles.ditu.live.com/comp/ch/{quadKey}?it=G,TW,L,LA&mkt=zh-cn&og=109&cstl=w4c&ur=CN&n=z';
        return new ol.source.XYZ({
            wrapX: false,
            projection: projection,
            tileUrlFunction: function (coordinates) {
                let /*quadDigits = '', */[z, x, y] = [...coordinates];
                y = y > 0 ? y - 1 : -y - 1;
                let index = '';
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

    /**
     * 创建图层的source
     * @param layerInfo
     * @param url
     * @returns {ol.source.XYZ}
     */
    createXYZSource(layerInfo, url) {
        return new ol.source.XYZ({
            url: url,
            wrapX: false,
            crossOrigin: window.location.host
        })
    }

    /**
     * 创建wms地图source
     * @param layerInfo
     * @returns {ol.source.TileWMS}
     */
    createWMSSource(layerInfo) {
        let that = this;
        return new ol.source.TileWMS({
            url: layerInfo.url,
            wrapX: false,
            params: {
                LAYERS: layerInfo.layers[0] || "0",
                FORMAT: 'image/png'
            },
            projection: layerInfo.projection,
            tileLoadFunction: function (imageTile, src) {
                imageTile.getImage().src = src
            }
        })
    }

    getWmtsInfo(layerInfo, callback) {
        let that = this;
        let url = layerInfo.url;
        let options = {
            withCredentials: false,
            withoutFormatSuffix:true
        };
        FetchRequest.get(url, null, options).then(function (response) {
            return response.text();
        }).then(function (capabilitiesText) {
            const format = new ol.format.WMTSCapabilities();
            let capabilities = format.read(capabilitiesText);
            if (that.isValidResponse(capabilities)) {
                let content = capabilities.Contents,
                    tileMatrixSet = content.TileMatrixSet,
                    layers = content.Layer, layer, tileMatrixSetLink, relSet = [], idx;

                for(let n=0; n<layers.length; n++) {
                    if(layers[n].Title === layerInfo.name) {
                        idx= n;
                        layer = layers[idx];
                        tileMatrixSetLink = layer.TileMatrixSetLink;
                        break;
                    }
                }
                let scales = [];
                for(let i=0; i<tileMatrixSet.length; i++) {
                    if(tileMatrixSet[i].Identifier === layerInfo.tileMatrixSet) {
                        for (let h = 0; h < tileMatrixSet[i].TileMatrix.length; h++) {
                            scales.push(tileMatrixSet[i].TileMatrix[h].ScaleDenominator)
                        }
                        break;
                    }
                }
                let name = layerInfo.name,
                    layerBounds = layer.WGS84BoundingBox,
                    extent = ol.proj.transformExtent(layerBounds, 'EPSG:4326', that.baseProjection),
                    matrixSet = relSet[idx];
                //将需要的参数补上
                layerInfo.dpi = 90.7;
                layerInfo.extent = extent;
                layerInfo.format = "image/png";
                layerInfo.matrixSet = matrixSet;
                layerInfo.name = name;
                layerInfo.orginEpsgCode = layerInfo.projection;
                layerInfo.overLayer = true;
                //只有这种，Dataviz里面不应该选择
                layerInfo.requestEncoding = 'KVP';
                layerInfo.scales = scales;
                layerInfo.style = "default";
                layerInfo.title = name;
                layerInfo.unit = "m";
                layerInfo.zIndex = idx;
                callback(layerInfo);
            }
        });
    }

    /**
     * 获取WMTS类型图层的source
     *
     * @param {object} layerInfo
     * @returns
     */
    createWMTSSource(layerInfo) {
        let extent = layerInfo.extent || ol.proj.get(layerInfo.projection).getExtent();
        let that = this;
        return new ol.source.WMTS({
            url: layerInfo.url,
            layer: layerInfo.name,
            format: 'image/png',
            // style: 'default',
            matrixSet: layerInfo.tileMatrixSet,
            requestEncoding: layerInfo.requestEncoding || 'KVP',
            tileGrid: this.getWMTSTileGrid(extent, layerInfo.scales, layerInfo.unit, layerInfo.dpi),
            tileLoadFunction: function (imageTile, src) {
                imageTile.getImage().src = src
            }
        })
    }

    /**
     * 获取wmts的瓦片
     * @param extent
     * @param scales
     * @param unit
     * @param dpi
     * @returns {ol.tilegrid.WMTS}
     */
    getWMTSTileGrid(extent, scales, unit, dpi) {
        let resolutionsInfo = this.getReslutionsFromScales(scales, dpi || 96, unit);
        return new ol.tilegrid.WMTS({
            extent: extent,
            resolutions: resolutionsInfo.res,
            matrixIds: resolutionsInfo.matrixIds
        });
    }

    /**
     * 根据比例尺（比例尺分母）、地图单位、dpi、获取一个分辨率数组
     * @param scales
     * @param dpi
     * @param unit
     * @param datumAxis
     * @returns {{res: Array, matrixIds: Array}}
     */
    getReslutionsFromScales(scales, dpi, unit, datumAxis) {
        unit = (unit && unit.toLowerCase()) || 'degrees';
        dpi = dpi > 0 ? dpi : 96;
        datumAxis = datumAxis || 6378137;
        let res = [], matrixIds = [];
        //这他妈的api不给identifier 我自己给个默认的
        if(Util.isArray(scales)) {
            scales && scales.forEach(function (scale, idx) {
                matrixIds.push(idx);
                res.push(this.getResolutionFromScale(scale, dpi, unit, datumAxis));
            }, this);
        }
        else {
            let tileMatrixSet = scales['TileMatrix'];
            tileMatrixSet && tileMatrixSet.forEach(function (tileMatrix) {
                matrixIds.push(tileMatrix['Identifier']);
                res.push(this.getResolutionFromScale(tileMatrix['ScaleDenominator'], dpi, unit, datumAxis));
            }, this);
        }
        return { res: res, matrixIds: matrixIds };
    }

    /**
     * 获取一个WMTS source需要的tileGrid
     * @param scale
     * @param dpi
     * @param unit
     * @param datumAxis
     * @returns {number}
     */
    getResolutionFromScale(scale, dpi, unit, datumAxis) {
        //radio = 10000;
        let res;
        scale = +scale;
        scale = (scale > 1.0) ? (1.0 / scale) : scale;
        if (unit === 'degrees' || unit === 'dd' || unit === 'degree') {
            res = 0.0254 * 10000 / dpi / scale / ((Math.PI * 2 * datumAxis) / 360) / 10000;
        }
        else {
            res = 0.0254 * 10000 / dpi / scale / 10000;
        }
        return res;

    }

    /**
     * 返回信息是否符合对应类型的标准
     * @param response
     * @returns {boolean}
     */
    isValidResponse(response) {
        let responseEnum = ['Contents', 'OperationsMetadata'], valid = true;
        if (responseEnum) {
            for (let i = 0; i < responseEnum.length; i++) {
                if (!response[responseEnum[i]] || response.error) {
                    valid = false;
                    break;
                }
            }
        }
        else {
            valid = false;
        }
        return valid;
    }

    /**
     * 添加除了底图之外的其余图层
     * @param mapInfo 地图信息
     */
    addLayers(mapInfo) {
        let layers = mapInfo.layers, that = this;
        let features, layerAdded = 0, len = layers.length;
        if(len > 0) {
            layers.forEach(function (layer) {
                if((layer.dataSource && layer.dataSource.serverId) || layer.layerType === "MARKER") {
                    //数据存储到iportal上了
                    let serverId = layer.dataSource ? layer.dataSource.serverId : layer.serverId;
                    let url = `${Util.getRootUrl(that.mapUrl)}web/datas/${serverId}/content.json?pageSize=9999999&currentPage=1`;
                    FetchRequest.get(url, null, {withCredentials: true}).then(function (response) {
                        return response.json()
                    }).then(function (data) {
                        if(data && data.type) {
                            if (!data) {
                                features = [];
                            } else if (data.type === "JSON" || data.type === "GEOJSON") {
                                data.content = JSON.parse(data.content);
                                features = that.geojsonToFeature(data.content, layer);
                            } else if (data.type === 'EXCEL' || data.type === 'CSV') {
                                features = that.excelData2Feature(data.content, layer);
                            }
                            that.addLayer(layer, features);
                            layerAdded++;
                            that.sendMapToUser(layerAdded, len);
                        }
                    }).catch(function () {
                        layerAdded++;
                        that.sendMapToUser(layerAdded, len);
                    })
                } else if(layer.layerType === "TILE" || layer.layerType === "WMS" || layer.layerType === "WMTS") {
                    if(layer.layerType === "WMTS") {
                        that.getWmtsInfo(layer, function (layerInfo) {
                            that.map.addLayer(that.createBaseLayer(layerInfo));
                        })
                    } else {
                        that.map.addLayer(that.createBaseLayer(layer));
                    }
                    layerAdded++;
                    that.sendMapToUser(layerAdded, len);
                } else if(layer.dataSource && layer.dataSource.type === "REST_DATA") {
                    let dataSource = layer.dataSource;
                    //从restData获取数据
                    Util.getFeatureBySQL(dataSource.url, [dataSource.dataSourseName || layer.name], function(result) {
                        features = that.parseGeoJsonData2Feature({
                            allDatas: { features: result.result.features.features },
                            fileCode: layer.projection,
                            featureProjection: that.baseProjection
                        });

                        /*if (!layerObj.layerInfo.dataTypes) {
                            let data = DataManager.assembleTableJSONData(result.result.features);
                            layerObj.layerInfo.dataTypes = Util.getFieldType(data.titles, data.rows[0]);
                        }*/
                        that.addLayer(layer, features);
                        layerAdded++;
                        that.sendMapToUser(layerAdded, len);
                    }, function(err) {
                        console.log(err);
                        layerAdded++;
                        that.sendMapToUser(layerAdded, len);
                    });
                }
            }, this);
        }
    }

    /**
     * 返回最终的map对象给用户，供他们操作使用
     * @param count
     * @param layersLen
     */
    sendMapToUser(count, layersLen) {
        if(count === layersLen) {
            this.callBack(this.map);
        }
    }
    /**
     * 将csv和xls文件内容转换成ol.feature
     * @param content  文件内容
     * @param layerInfo  图层信息
     * @returns {Array}  ol.feature的数组集合
     */
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

    /**
     * geojson 转换为 feature
     * @param geojson  geojson中的文件内容
     * @param layerInfo  图层信息
     * @returns {Array}  ol.feature的数组集合
     */
    geojsonToFeature(geojson, layerInfo) {
        let allFeatures = geojson.features,
            features = [];
        for (let i = 0, len = allFeatures.length; i < len; i++) {
            let feature = transformTools.readFeature(allFeatures[i], {
                dataProjection: layerInfo.projection || 'EPSG:4326',
                featureProjection: this.baseProjection || 'ESPG:4326'
            });
            //geojson格式的feature属性没有坐标系字段，为了统一，再次加上
            let coordinate = feature.getGeometry().getCoordinates();
            if (allFeatures[i].geometry.type === 'Point') {
                // 标注图层 还没有属性值时候不加
                if (allFeatures[i].properties) {
                    allFeatures[i].properties.lon = coordinate[0];
                    allFeatures[i].properties.lat = coordinate[1];
                }
            }
            feature.attributes = allFeatures[i].properties || {};

            // 标注图层特殊处理
            let isMarker = false;
            let featureInfo;
            let useStyle;
            if (allFeatures[i].dv_v5_markerInfo) {
                featureInfo = allFeatures[i].dv_v5_markerInfo;
                isMarker = true;
            }
            if (allFeatures[i].dv_v5_markerStyle) {
                useStyle = allFeatures[i].dv_v5_markerStyle;
                isMarker = true;
            }
            let properties;
            if (isMarker) {
                properties = Object.assign({}, { featureInfo: featureInfo }, { useStyle: useStyle });
                //feature上添加图层的id，为了对应图层
                feature.layerId = layerInfo.timeId;
                //删除不需要的属性，因为这两个属性存储在properties上
                delete feature.attributes.featureInfo;
                delete feature.attributes.useStyle;
            } else if (layerInfo.featureStyles) {
                //V4 版本标注图层处理
                let style = JSON.parse(layerInfo.featureStyles[i].style);
                let attr = feature.attributes;
                let imgUrl;
                if (attr._smiportal_imgLinkUrl.indexOf('http://') > -1 || attr._smiportal_imgLinkUrl.indexOf('https://') > -1) {
                    imgUrl = attr._smiportal_imgLinkUrl;
                } else if (attr._smiportal_imgLinkUrl !== undefined && attr._smiportal_imgLinkUrl !== null &&
                    attr._smiportal_imgLinkUrl !== '') {
                    //上传的图片，加上当前地址
                    imgUrl = `${Util.getIPortalUrl()}resources/markerIcon/${attr._smiportal_imgLinkUrl}`
                }
                featureInfo = {
                    dataViz_description: attr._smiportal_description,
                    dataViz_imgUrl: imgUrl,
                    dataViz_title: attr._smiportal_title,
                    dataViz_url: attr._smiportal_otherLinkUrl
                };
                style.anchor = [0.5, 1];
                style.src = style.externalGraphic;

                useStyle = style;
                properties = Object.assign({}, { featureInfo: featureInfo }, { useStyle: useStyle });
                delete attr._smiportal_description;
                delete attr._smiportal_imgLinkUrl;
                delete attr._smiportal_title;
                delete attr._smiportal_otherLinkUrl;
            } else {
                properties = feature.attributes;
            }

            feature.setProperties(properties);
            features.push(feature);
        }
        return features;
    }

    /**
     * 将从restData地址上获取的json转换成feature（从iserver中获取的json转换成feature）
     * @param metaData  json内容
     * @returns {Array} ol.feature的数组集合
     */
    parseGeoJsonData2Feature(metaData) {
        let allFeatures = metaData.allDatas.features,
            features = [];
        for (let i = 0, len = allFeatures.length; i < len; i++) {
            let feature = transformTools.readFeature(allFeatures[i], {
                dataProjection: metaData.fileCode || 'EPSG:4326',
                featureProjection: metaData.featureProjection || Util.getBaseLayerProj() || 'EPSG:4326'
            });
            //geojson格式的feature属性没有坐标系字段，为了统一，再次加上
            let coordinate = feature.getGeometry().getCoordinates();
            if (allFeatures[i].geometry.type === 'Point') {
                allFeatures[i].properties.lon = coordinate[0];
                allFeatures[i].properties.lat = coordinate[1];
            }
            feature.attributes = allFeatures[i].properties || {};
            feature.setProperties({ Properties: feature.attributes });
            features.push(feature);
        }
        return features;
    }

    /**
     * 将单个图层添加到地图上
     * @param layerInfo  某个图层的图层信息
     * @param features   图层上的feature
     */
    addLayer(layerInfo, features) {
        let layer, allFeatures;
        if(layerInfo.style && layerInfo.style.filterCondition) {
            if(layerInfo.layerType === "RANGE") {
                allFeatures = features;
            }
            //将feature根据过滤条件进行过滤, 分段专题图因为要计算styleGroup所以暂时不过滤
            features = this.getFiterFeatures(layerInfo.style.filterCondition, features);
        }
        if(layerInfo.layerType === "VECTOR") {
            if (layerInfo.featureType === "POINT") {
                if(layerInfo.style.type === 'SYMBOL_POINT') {
                    layer = this.createSymbolLayer(layerInfo, features);
                } else{
                    layer = this.createGraphicLayer(layerInfo, features);
                }
            } else {
                //线和面
                layer = this.createVectorLayer(layerInfo, features)
            }
        } else if(layerInfo.layerType === "UNIQUE") {
            layer = this.createUniqueLayer(layerInfo, features);
        } else if(layerInfo.layerType === "RANGE") {
            layer = this.createRangeLayer(layerInfo, features, allFeatures);
        } else if(layerInfo.layerType === "HEAT") {
            layer = this.createHeatLayer(layerInfo, features);
        } else if(layerInfo.layerType === "MARKER"){
            layer = this.createMarkerLayer(layerInfo, features)
        }
        if(layerInfo.name) {
            layer.setProperties({name: layerInfo.name});
        }
        layer && this.map.addLayer(layer);
        if(layerInfo.labelStyle && layerInfo.labelStyle.labelField) {
            //存在标签专题图
            this.addLabelLayer(layerInfo, features);
        }
    }
    /**
     * 通过过滤条件查询满足的feature
     * @param filterCondition {String} 过滤条件
     */
    getFiterFeatures(filterCondition, allFeatures) {
        let jsonsql = window.jsonsql;
        let condition = this.replaceFilterCharacter(filterCondition);
        let sql = "select * from json where (" + condition + ")";
        let filterFeatures = [];
        for (let i = 0; i < allFeatures.length; i++) {
            let feature = allFeatures[i];
            let filterResult = false;
            try {
                filterResult = jsonsql.query(sql, { attributes: feature.attributes });
            } //必须把要过滤得内容封装成一个对象,主要是处理jsonsql(line : 62)中由于with语句遍历对象造成的问题
            catch (err) {
                return false;
            }
            if (filterResult && filterResult.length > 0) {
                //afterFilterFeatureIdx.push(i);
                filterFeatures.push(feature);
            }
        }
        return filterFeatures;
    }
    //替换查询语句 中的 and / AND / or / OR / = / !=
    replaceFilterCharacter(filterString) {
        filterString = filterString.replace(/=/g, '==').replace(/AND|and/g, '&&').replace(/or|OR/g, '||').replace(/<==/g, '<=').replace(/>==/g, '>=');
        return filterString;
    }
    /**
     * 添加大数据图层到地图上
     * @param layerInfo
     * @param features
     */
    createGraphicLayer(layerInfo, features) {
        let graphics = this.getGraphicsFromFeatures(features, layerInfo.style);
        let source = new ol.source.Graphic({
            graphics: graphics,
            render: 'canvas',
            map: this.map,
            isHighLight: false,
            onClick: function(graphic){}
        });
        source.refresh();
        return new ol.layer.Image({source: source});
    }

    /**
     * 将feature转换成大数据图层对应的Graphics要素
     * @param features
     * @param style
     * @returns {Array}
     */
    getGraphicsFromFeatures(features, style) {
        let olStyle, shape;
        if(style.type === "IMAGE_POINT") {
            //image-point
            let imageInfo = style.imageInfo;
            let imgDom = imageInfo.img;
            if(!imgDom || !imgDom.src) {
                imgDom = new Image();
                //要组装成完整的url
                imgDom.src = Util.getRootUrl(this.mapUrl) + imageInfo.url;
            }
            shape = new ol.style.Icon({
                img:  imgDom,
                scale: 2*style.radius/imageInfo.size.w,
                imgSize: [imageInfo.size.w, imageInfo.size.h],
                anchor : [0.5, 0.5]
            });
        } else if(style.type === "SVG_POINT") {
            if(!this.svgDiv) {
                this.svgDiv = document.createElement('div');
                document.body.appendChild(this.svgDiv);
            }
            let that = this;
            StyleUtils.getCanvasFromSVG(style.url, this.svgDiv, function (canvas) {
                shape = new ol.style.Icon({
                    img:  that.setColorToCanvas(canvas,style),
                    scale: style.radius/canvas.width,
                    imgSize: [canvas.width, canvas.height],
                    anchor : [0.5, 0.5],
                    opacity: style.fillOpacity
                });
            });
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
    /**
     * 将颜色，透明度等样式设置到canvas上
     * @param canvas
     * @param parameters
     * @returns {*}
     */
    setColorToCanvas(canvas,parameters) {
        let context = canvas.getContext('2d');
        let fillColor = StyleUtils.hexToRgb(parameters.fillColor);
        fillColor && fillColor.push(parameters.fillOpacity);
        let strokeColor = StyleUtils.hexToRgb(parameters.strokeColor);
        strokeColor && strokeColor.push(parameters.strokeOpacity);
        context.fillStyle = StyleUtils.formatRGB(fillColor);
        context.fill();
        context.strokeStyle = StyleUtils.formatRGB(strokeColor);
        context.lineWidth = parameters.strokeWidth;
        context.stroke();
        return canvas;
    }

    /**
     * 添加符号图层
     * @param layerInfo
     * @param features
     */
    createSymbolLayer(layerInfo, features) {
        /*let div = document.createElement("div");
        div.setAttribute('class','supermapol-icons-Shape-56');
        document.body.appendChild(div);
        div.style.display = "none";*/
        let style = this.getSymbolStyle(layerInfo.style);
        return new ol.layer.Vector({
            style: style,
            source: new ol.source.Vector({
                features: features,
                wrapX: false
            })
        });
    }

    /**
     * 获取符号样式
     * @param parameters
     * @returns {ol.style.Style}
     */
    getSymbolStyle(parameters){
        let text = '';
        if(parameters.unicode){
            //todo 为什么要判断，难道还有其他的图层会进来
            text = String.fromCharCode(parseInt(parameters.unicode.replace(/^&#x/, ''), 16));
        }
        // 填充色 + 透明度
        let fillColor = StyleUtils.hexToRgb(parameters.fillColor);
        fillColor.push(parameters.fillOpacity);
        // 边框充色 + 透明度
        let strokeColor = StyleUtils.hexToRgb(parameters.strokeColor);
        strokeColor.push(parameters.strokeOpacity);
        return new ol.style.Style({
            text: new ol.style.Text({
                text: text,
                font: parameters.fontSize + " " + "supermapol-icons",
                placement: 'point',
                textAlign: 'center',
                fill: new ol.style.Fill({ color: fillColor}),
                backgroundFill: new ol.style.Fill({ color: [0, 0, 0, 0]}),
                stroke: new ol.style.Stroke({
                    width: parameters.strokeWidth || 0.000001,
                    color: strokeColor
                })
            })
        });
    }
    /**
     * 添加标签图层
     * @param layerInfo
     * @param features
     */
    addLabelLayer(layerInfo, features) {
        let labelStyle = layerInfo.labelStyle;
        let style = this.getLabelStyle(labelStyle);
        let layer = new ol.layer.Vector({
            declutter: true,
            styleOL: style,
            labelField: labelStyle.labelField,
            source: new ol.source.Vector({
                features: features,
                wrapX: false
            })
        });
        layer.setStyle(features => {
            let labelField = labelStyle.labelField;
            let label = features.attributes[labelField.trim()] + "";
            if(label === "undefined") return null;
            let styleOL = layer.get('styleOL');
            let text = styleOL.getText();
            if(text && text.setText){
                text.setText(label);
            }
            return styleOL;
        });
        this.map.addLayer(layer);
    }

    /**
     * 获取标签样式
     * @param parameters
     * @returns {ol.style.Style}
     */
    getLabelStyle(parameters) {
        return new ol.style.Style({
            text: new ol.style.Text({
                font: parameters.fontSize + " " +parameters.fontFamily,
                placement: 'point',
                textAlign: 'center',
                fill: new ol.style.Fill({ color: parameters.fill}),
                backgroundFill: new ol.style.Fill({ color: parameters.backgroundFill}),
                padding: [3, 3, 3, 3],
                offsetY: parameters.offsetY
            })
        });
    }

    /**
     * 创建vector图层
     * @param layerInfo
     * @param features
     * @returns {ol.layer.Vector}
     */
    createVectorLayer (layerInfo, features) {
        let style = StyleUtils.toOpenLayersStyle(layerInfo.style, layerInfo.featureType);
        return new ol.layer.Vector({
            style: style,
            source: new ol.source.Vector({
                features: features,
                wrapX: false
            })
        });
    }

    /**
     * 创建热力图图层
     * @param layerInfo
     * @param features
     * @returns {ol.layer.Heatmap}
     */
    createHeatLayer(layerInfo, features) {
        let source = new ol.source.Vector({
            features: features,
            wrapX: false
        });
        let layerOptions = {
            source: source
        };
        let style = layerInfo.style;
        layerOptions.gradient = style.colors.slice();
        layerOptions.radius = parseInt(style.radius);
        //自定义颜色
        let customSettings = style.customSettings;
        for (let i in customSettings) {
            layerOptions.gradient[i] = customSettings[i];
        }
        // 权重字段恢复
        if(style.weight){
            this.changeWeight(features, style.weight);
        }
        return new ol.layer.Heatmap(layerOptions);
    }
    /**
     * 改变当前权重字段
     * @param features {Array} feature 数组
     * @param weightFeild {String} 权重字段
     */
    changeWeight(features, weightFeild) {
        this.fieldMaxValue = {};
        this.getMaxValue(features,weightFeild);
        let maxValue = this.fieldMaxValue[weightFeild];
        features.forEach(function (feature) {
            let attributes = feature.get("Properties") || feature.attributes;
            try {
                let value = attributes[weightFeild];
                feature.set('weight', value/ maxValue);
            }catch (e){
                // V2 热力图没有权重字段 但恢复回来却有权重字段
            }
        })
    }
    /**
     * 获取当前字段对应的最大值，用于计算权重
     * @param features {Array} feature 数组
     * @param weightField {String} 权重字段
     */
    getMaxValue(features, weightField) {
        let values = [], attributes;
        let field = weightField || this.defaultParameters.weight;
        if(this.fieldMaxValue[field]) return;
        features.forEach(function(feature){
            //收集当前权重字段对应的所有值
            attributes = feature.get("Properties") || feature.attributes;
            try {
                values.push(parseFloat(attributes[field])) ;
            }catch (e){
                // V2 热力图没有权重字段 但恢复回来却有权重字段
            }
        });
        this.fieldMaxValue[field] = ArrayStatistic.getArrayStatistic(values, 'Maximum');
    }

    /**
     * 创建单值图层
     * @param layerInfo
     * @param features
     * @returns {ol.layer.Vector}
     */
    createUniqueLayer(layerInfo, features){
        let styleSource = this.createUniqueSource(layerInfo, features);
        let layer = new ol.layer.Vector({
            styleSource: styleSource,
            source: new ol.source.Vector({
                features: features,
                wrapX: false
            })
        });
        layer.setStyle(feature => {
            let styleSource = layer.get('styleSource');
            let labelField = styleSource.themeField;
            let label = feature.attributes[labelField];
            return styleSource.styleGroups[label].olStyle;
        });

        return layer;
    }

    /**
     * 创建单值图层的source
     * @param parameters {layerInfo} 图层信息
     * @param features
     * @returns {{map: *, style: *, isHoverAble: *, highlightStyle: *, themeField: *, styleGroups: Array}}
     */
    createUniqueSource(parameters, features){
        //找到合适的专题字段
        let styleGroup = this.getUniqueStyleGroup(parameters, features);
        return {
            map: this.map, //必传参数 API居然不提示
            style: parameters.style ,
            isHoverAble: parameters.isHoverAble,
            highlightStyle: parameters.highlightStyle,
            themeField: parameters.themeSetting.themeField,
            styleGroups: styleGroup
        };
    }

    /**
     * 获取单值专题图的styleGroup
     * @param parameters
     * @param features
     * @returns {Array}
     */
    getUniqueStyleGroup(parameters, features){
        // 找出所有的单值
        let featureType = parameters.featureType, style = parameters.style, themeSetting = parameters.themeSetting;
        let fieldName = themeSetting.themeField,
            colors = themeSetting.colors;

        let names = [], customSettings = themeSetting.customSettings;
        for(let i in features){
            let attributes = features[i].attributes;
            let name = attributes[fieldName];
            let isSaved = false;
            for(let j in names){
                if(names[j] === name) {
                    isSaved = true;
                    break;
                }
            }
            if(!isSaved){
                names.push(name);
            }
        }

        //获取一定量的颜色
        let curentColors = colors || this.defaultParameters.colors;
        curentColors = ColorsPickerUtil.getGradientColors(curentColors, names.length);

        //生成styleGroup
        let styleGroup = [];
        names.forEach(function(name,index){
            let color = curentColors[index];
            if (name in customSettings) {
                color = customSettings[name];
            }
            if(featureType === "LINE"){
                style.strokeColor = color;
            }else {
                style.fillColor = color;
            }
            // 转化成 ol 样式
            let olStyle = StyleUtils.toOpenLayersStyle(style, featureType);

            styleGroup[name] = {olStyle: olStyle, color: color, value: name};
        });

        return styleGroup;
    }

    /**
     * 创建分段图层
     * @param layerInfo
     * @param features
     * @param allFeatures
     * @returns {ol.layer.Vector}
     */
    createRangeLayer(layerInfo, features, allFeatures){
        //这里获取styleGroup要用所以的feature
        let styleSource = this.createRangeSource(layerInfo, allFeatures || features);
        let layer = new ol.layer.Vector({
            styleSource: styleSource,
            source: new ol.source.Vector({
                features: features,
                wrapX: false
            })
        });

        layer.setStyle(feature => {
            let styleSource = layer.get('styleSource');
            if(styleSource){
                let labelField = styleSource.themeField;
                let value = Number(feature.attributes[labelField.trim()]);
                let styleGroups = styleSource.styleGroups;
                for(let i = 0; i < styleGroups.length; i++){
                    if(i === 0){
                        if(value >= styleGroups[i].start && value <= styleGroups[i].end){
                            return styleGroups[i].olStyle;
                        }
                    }else {
                        if(value > styleGroups[i].start && value <= styleGroups[i].end){
                            return styleGroups[i].olStyle;
                        }
                    }
                }
            }
        });

        return layer;
    }

    /**
     * 创建分段专题图的图层source
     * @param parameters {layerInfo} 图层信息
     * @param features
     * @returns {*}
     */
    createRangeSource(parameters, features){
        //找到合适的专题字段
        let styleGroup = this.getRangeStyleGroup(parameters, features);
        if(styleGroup){
            return {
                style: parameters.style || this.defaultParameters.style,
                themeField: parameters.themeSetting.themeField,
                styleGroups: styleGroup
            };
        }else {
            return false;
        }
    }
    getRangeStyleGroup(parameters, features){
        // 找出分段值
        let featureType = parameters.featureType, themeSetting = parameters.themeSetting,
            style = parameters.style;
        let count = themeSetting.segmentCount, method = themeSetting.segmentMethod,
            colors = themeSetting.colors, customSettings = themeSetting.customSettings,
            fieldName = themeSetting.themeField;
        let values = [], attributes;
        let segmentCount = count || this.defaultParameters.segmentCount;
        let segmentMethod = method || this.defaultParameters.segmentMethod;

        features.forEach(function(feature){
            attributes = feature.get("Properties") || feature.attributes;
            try{
                if (attributes) {
                    //过滤掉非数值的数据
                    let value =attributes[fieldName.trim()];
                    if (value && Util.isNumber(value)) {
                        values.push(parseFloat(value)) ;
                    }
                } else if(feature.get(fieldName) && Util.isNumber(feature.get(fieldName))) {
                    if (feature.get(fieldName)) {
                        values.push(parseFloat(feature.get(fieldName))) ;
                    }
                }
            }catch (e){
                // console.log(e);
            }

        });

        let segements;
        try {
            segements = ArrayStatistic.getArraySegments(values, segmentMethod, segmentCount);
        }catch (e){
            // console.log(e);
        }
        if(segements){
            let itemNum = segmentCount;
            if(attributes && segements[0] === segements[attributes.length-1]) {
                itemNum = 1;
                segements.length = 2;
            }

            //保留两位有效数
            for(let key in segements){
                let value = segements[key];
                if(key === 0){
                    // 最小的值下舍入
                    value = Math.floor(value*100)/100;
                }else {
                    // 其余上舍入
                    value = Math.ceil(value*100)/100 + 0.1; // 加0.1 解决最大值没有样式问题
                }

                segements[key] = Number(value.toFixed(2));
            }

            //获取一定量的颜色
            let curentColors = colors || this.defaultParameters.colors;
            curentColors = ColorsPickerUtil.getGradientColors(curentColors, itemNum, 'RANGE');

            for (let index = 0; index < itemNum; index++) {
                if (index in customSettings) {
                    if (customSettings[index]["segment"]["start"]) {
                        segements[index] = customSettings[index]["segment"]["start"];
                    }
                    if(customSettings[index]["segment"]["end"]) {
                        segements[index + 1] = customSettings[index]["segment"]["end"];
                    }
                }
            }
            //生成styleGroup
            let styleGroups = [];
            for(let i = 0; i < itemNum; i++) {
                let color = curentColors[i];
                if (i in customSettings) {
                    if (customSettings[i].color) {
                        color = customSettings[i].color;
                    }
                }
                if(featureType === "LINE"){
                    style.strokeColor = color;
                }else {
                    style.fillColor = color;
                }

                // 转化成 ol 样式
                let olStyle = StyleUtils.toOpenLayersStyle(style, featureType);

                let start = segements[i];
                let end = segements[i + 1];

                styleGroups.push({olStyle: olStyle, color: color, start: start, end: end});
            }

            return styleGroups;
        }else {
            return false;
        }
    }
    createMarkerLayer(layerInfo, features) {
        features && this.setEachFeatureDefaultStyle(features);
        return new ol.layer.Vector({
            source: new ol.source.Vector({
                features: features,
                wrapX: false
            })
        });
    }
    /**
     * @description 为feature设置样式
     * @author gaozy
     * @param {any} features
     * @param {any} [style=null]
     * @param {Number} 图层id
     */
    setEachFeatureDefaultStyle(features, timeId) {
        let that = this;
        features = (Util.isArray(features) || features instanceof ol.Collection) ? features : [features];
        features.forEach(function (feature) {
            let geomType = feature.getGeometry().getType().toUpperCase();
            // let styleType = geomType === "POINT" ? 'MARKER' : geomType;
            let defaultStyle = feature.getProperties().useStyle;
            if(geomType === 'POINT' && defaultStyle.text) {
                //说明是文字的feature类型
                geomType = "TEXT";
            }
            let featureInfo = this.setFeatureInfo(feature);
            feature.setProperties({ useStyle: defaultStyle, featureInfo:featureInfo});
            //标注图层的feature上需要存一个layerId，为了之后样式应用到图层上使用
            feature.layerId = timeId;
            if(geomType === 'POINT' && defaultStyle.src &&
                defaultStyle.src.indexOf('http://') === -1 && defaultStyle.src.indexOf('https://') === -1) {
                //说明地址不完整
                defaultStyle.src = Util.getRootUrl(that.mapUrl) + defaultStyle.src;
            }
            feature.setStyle(StyleUtils.toOpenLayersStyle(defaultStyle, geomType))
        }, this)
    }
    setFeatureInfo(feature) {
        let featureInfo;
        if(feature.getProperties().featureInfo && feature.getProperties().featureInfo.dataViz_title !== undefined
            && feature.getProperties().featureInfo.dataViz_title != null) {
            //有featureInfo信息就不需要再添加
            featureInfo = feature.getProperties().featureInfo;
        } else {
            featureInfo = this.getDefaultAttribute();
        }
        let properties = feature.getProperties();
        for(let key in featureInfo) {
            if(properties[key]) {
                featureInfo[key] = properties[key];
                delete properties[key];
            }
        }
        return featureInfo;
    }
}

ol.supermap.DatavizWebMap = DatavizWebMap;