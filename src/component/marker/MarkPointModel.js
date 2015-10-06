define(function (require) {

    var zrUtil = require('zrender/core/util');

    var Model = require('../../model/Model');

    // Default enable markpoint
    var globalDefault = require('../../model/globalDefault');
    globalDefault.markPoint = {};

    var MarkPointModel = require('../../echarts').extendComponentModel({

        type: 'markPoint',

        dependencies: ['series', 'grid', 'polar'],
        /**
         * @overrite
         */
        init: function (option, parentModel, ecModel, dependentModels, idx, createdBySelf) {
            this.mergeDefaultAndTheme(option, ecModel);
            this.mergeOption(option, createdBySelf);
        },

        mergeOption: function (newOpt, createdBySelf) {
            // If not created by self for each series
            if (!createdBySelf) {
                var ecModel = this.ecModel;
                ecModel.eachSeries(function (seriesModel) {
                    var markPointOpt = seriesModel.get('markPoint');
                    if (markPointOpt && markPointOpt.data) {
                        var mpModel = seriesModel.markPointModel;
                        if (!mpModel) {
                            mpModel = new MarkPointModel(
                                markPointOpt, this, ecModel, [], 0, true
                            );
                        }
                        else {
                            mpModel.mergeOption(markPointOpt, true);
                        }
                        // Use the same series index
                        mpModel.seriesIndex = seriesModel.seriesIndex;
                        seriesModel.markPointModel = mpModel;
                    }
                    else {
                        seriesModel.markPointModel = null;
                    }
                }, this);
            }
        },

        defaultOption: {
            zlevel: 0,
            z: 5,
            clickable: true,
            symbol: 'pin',         // 标注类型
            symbolSize: [30, 50],        // 标注大小
            // symbolRotate: null, // 标注旋转控制
            large: false,
            effect: {
                show: false,
                loop: true,
                // 运动周期，无单位，值越大越慢
                period: 15,
                // 可用为 scale | bounce
                type: 'scale',
                // 放大倍数，以markPoint点size为基准
                scaleSize: 2,
                // 跳动距离，单位px
                bounceDistance: 10
                // color: 'gold',
                // shadowColor: 'rgba(255,215,0,0.8)',
                // 炫光模糊
                // shadowBlur: 0
            },
            itemStyle: {
                normal: {
                    // color: 各异，
                    // 标注边线颜色，优先于color
                    // borderColor: 各异,
                    // 标注边线线宽，单位px，默认为1
                    borderWidth: 2,
                    label: {
                        show: true,
                        // 标签文本格式器，同Tooltip.formatter，不支持回调
                        // formatter: null,
                        // 可选为'left'|'right'|'top'|'bottom'
                        position: 'inside'
                        // 默认使用全局文本样式，详见TEXTSTYLE
                        // textStyle: null
                    }
                },
                emphasis: {
                    // color: 各异
                    label: {
                        show: true
                        // 标签文本格式器，同Tooltip.formatter，不支持回调
                        // formatter: null,
                        // position: 'inside'  // 'left'|'right'|'top'|'bottom'
                        // textStyle: null     // 默认使用全局文本样式，详见TEXTSTYLE
                    }
                }
            }
        }
    });

    return MarkPointModel;
});