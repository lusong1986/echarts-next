define(function (require) {

    var zrUtil = require('zrender/core/util');
    var graphic = require('../../util/graphic');

    var EPSILON = 1e-4;
    var PI2 = Math.PI * 2;
    var PI = Math.PI;

    /**
     * A final axis is translated and rotated from a "standard axis".
     * So opt.position and opt.rotation is required.
     *
     * A standard axis is and axis from [0, 0] to [0, axisExtent[1]],
     * for example: (0, 0) ------------> (0, 50)
     *
     * tickDirection or labelDirection is 1 means tick or label is below
     * the standard axis, whereas -1 means above the standard axis.
     *
     * Tips: like always,
     * positive rotation represents anticlockwise, and negative rotation
     * represents clockwise.
     * The direction of position coordinate is the same as the direction
     * of screen coordinate.
     * Do not need to consider axis 'inverse', which is auto processed by
     * axis extent.
     *
     * @param {module:zrender/container/Group} group
     * @param {Object} axisModel
     * @param {Object} opt Standard axis parameters.
     * @param {Array.<number>} opt.position [x, y]
     * @param {number} opt.rotation by radian
     * @param {number} opt.tickDirection 1 or -1
     * @param {number} opt.labelDirection 1 or -1
     * @param {string} [opt.axisName] default get from axisModel.
     * @param {number} [opt.lableRotation] by degree, default get from axisModel.
     * @param {number} [opt.lableInterval] Default label interval when label
     *                                     interval from model is null or 'auto'.
     * @param {number} [opt.strokeContainThreshold] Default label interval when label
     * @param {number} [opt.silent=true]
     * @param {number} [opt.isCartesian=false]
     */
    var AxisBuilder = function (axisModel, opt) {

        /**
         * @readOnly
         */
        this.opt = opt;

        /**
         * @readOnly
         */
        this.axisModel = axisModel;

        /**
         * @readOnly
         */
        this.group = new graphic.Group({
            position: opt.position.slice(),
            rotation: opt.rotation
        });
    };

    AxisBuilder.prototype = {

        constructor: AxisBuilder,

        hasBuilder: function (name) {
            return !!builders[name];
        },

        add: function (name) {
            builders[name].call(this);
        },

        getGroup: function () {
            return this.group;
        },

        /**
         * Extent is always form 'start' to 'end',
         * when raw axis is 'inverse', the standard axis is like <----,
         * and extent[0] > extent[1].
         * when not 'inverse', the standard axis is like ---->,
         * and extent[1] > extent[0].
         * @inner
         */
        _getExtent: function () {
            var opt = this.opt;
            var extent = this.axisModel.axis.getExtent();

            opt.offset = 0;

            // FIXME
            // 修正axisExtent不统一，并考虑inverse。
            if (opt.isCartesian) {
                // var min = Math.min(extent[0], extent[1]);
                // var max = Math.max(extent[0], extent[1]);
                // opt.offset = min;
                // extent = [0, max - opt.offset];
            }

            return extent;
        }

    };

    var builders = {

        /**
         * @private
         */
        axisLine: function () {
            var opt = this.opt;
            var axisModel = this.axisModel;

            if (!axisModel.get('axisLine.show')) {
                return;
            }

            var extent = this._getExtent();

            this.group.add(new graphic.Line({
                shape: {
                    x1: extent[0],
                    y1: 0,
                    x2: extent[1],
                    y2: 0
                },
                style: zrUtil.extend(
                    {lineCap: 'round'},
                    axisModel.getModel('axisLine.lineStyle').getLineStyle()
                ),
                strokeContainThreshold: opt.strokeContainThreshold,
                silent: !!opt.silent,
                z2: 1
            }));
        },

        /**
         * @private
         */
        axisTick: function () {
            var axisModel = this.axisModel;

            if (!axisModel.get('axisTick.show')) {
                return;
            }

            var axis = axisModel.axis;
            var tickModel = axisModel.getModel('axisTick');
            var opt = this.opt;

            var lineStyleModel = tickModel.getModel('lineStyle');
            var tickLen = tickModel.get('length');
            var tickInterval = getInterval(tickModel, opt);
            var ticksCoords = axis.getTicksCoords();
            var tickLines = [];

            for (var i = 0; i < ticksCoords.length; i++) {
                // Only ordinal scale support tick interval
                if (ifIgnoreOnTick(axis, i, tickInterval)) {
                // ??? 检查 计算正确？（因为offset）
                     continue;
                }

                var tickCoord = ticksCoords[i] - opt.offset;

                // Tick line
                tickLines.push(new graphic.Line(graphic.subPixelOptimizeLine({
                    shape: {
                        x1: tickCoord,
                        y1: 0,
                        x2: tickCoord,
                        y2: opt.tickDirection * tickLen
                    },
                    style: {
                        lineWidth: lineStyleModel.get('width')
                    },
                    silent: true
                })));
            }

            this.group.add(graphic.mergePath(tickLines, {
                style: lineStyleModel.getLineStyle(),
                silent: true
            }));
        },

        /**
         * @param {module:echarts/coord/cartesian/AxisModel} axisModel
         * @param {module:echarts/coord/cartesian/GridModel} gridModel
         * @private
         */
        axisLabel: function () {
            var axisModel = this.axisModel;

            if (!axisModel.get('axisLabel.show')) {
                return;
            }

            var opt = this.opt;
            var axis = axisModel.axis;
            var labelModel = axisModel.getModel('axisLabel');
            var textStyleModel = labelModel.getModel('textStyle');
            var labelMargin = labelModel.get('margin');
            var ticks = axis.scale.getTicks();
            var labels = axisModel.getFormattedLabels();

            // Special label rotate.
            var labelRotation = opt.labelRotation;
            if (labelRotation == null) {
                labelRotation = labelModel.get('rotate') || 0;
            }
            // To radian.
            labelRotation = labelRotation * PI / 180;

            var labelLayout = innerTextLayout(opt, labelRotation);

            for (var i = 0; i < ticks.length; i++) {
                if (ifIgnoreOnTick(axis, i, opt.labelInterval)) {
                     continue;
                }

                var tickCoord = axis.dataToCoord(ticks[i]) - opt.offset;
                var pos = [tickCoord, opt.labelDirection * labelMargin];

                this.group.add(new graphic.Text({
                    style: {
                        text: labels[i],
                        textAlign: labelLayout.textAlign,
                        textBaseline: labelLayout.textBaseline,
                        textFont: textStyleModel.getFont(),
                        fill: textStyleModel.get('color')
                    },
                    position: pos,
                    rotation: labelLayout.rotation,
                    silent: true
                }));
            }
        },

        /**
         * @private
         */
        axisName: function () {
            var opt = this.opt;
            var axisModel = this.axisModel;

            var name = this.opt.axisName;
            // If name is '', do not get name from axisMode.
            if (name == null) {
                name = axisModel.get('name');
            }

            if (!name) {
                return;
            }

            var nameLocation = axisModel.get('nameLocation');
            var textStyleModel = axisModel.getModel('nameTextStyle');
            var gap = axisModel.get('nameGap') || 0;

            var extent = this._getExtent();
            var gapSignal = extent[0] > extent[1] ? -1 : 1;
            var pos = [
                nameLocation == 'start'
                    ? extent[0] - gapSignal * gap
                    : extent[1] + gapSignal * gap,
                0
            ];

            var labelLayout;

            if (nameLocation === 'middle') {
                labelLayout = innerTextLayout(opt, opt.rotation);
            }
            else {
                labelLayout = endTextLayout(opt, nameLocation, this._getExtent());
            }

            this.group.add(new graphic.Text({
                style: {
                    text: name,
                    textFont: textStyleModel.getFont(),
                    fill: textStyleModel.get('color')
                        || axisModel.get('axisLine.lineStyle.color'),
                    textAlign: labelLayout.textAlign,
                    textBaseline: labelLayout.textBaseline
                },
                position: pos,
                rotation: labelLayout.rotation,
                silent: true,
                z2: 1
            }));
        }

    };

    /**
     * @inner
     */
    function innerTextLayout(opt, textRotation) {
        var labelDirection = opt.labelDirection;
        var rotationDiff = remRadian(textRotation - opt.rotation);
        var textAlign;
        var textBaseline;

        if (isAroundZero(rotationDiff)) { // Label is parallel with axis line.
            textBaseline = labelDirection > 0 ? 'top' : 'bottom';
            textAlign = 'center';
        }
        else if (isAroundZero(rotationDiff - PI)) { // Label is inverse parallel with axis line.
            textBaseline = labelDirection > 0 ? 'bottom' : 'top';
            textAlign = 'center';
        }
        else {
            textBaseline = 'middle';

            if (rotationDiff > 0 && rotationDiff < PI) {
                textAlign = labelDirection > 0 ? 'right' : 'left';
            }
            else {
                textAlign = labelDirection > 0 ? 'left' : 'right';
            }
        }

        return {
            rotation: rotationDiff,
            textAlign: textAlign,
            textBaseline: textBaseline
        };
    }

    /**
     * @inner
     */
    function endTextLayout(opt, textPosition, extent) {
        var rotationDiff = remRadian(-opt.rotation);
        var textAlign;
        var textBaseline;
        var inverse = extent[0] > extent[1];
        var left = (textPosition === 'start' && !inverse)
            || (textPosition !== 'start' && inverse);

        if (isAroundZero(rotationDiff - PI / 2)) {
            textBaseline = left ? 'bottom' : 'top';
            textAlign = 'center';
        }
        else if (isAroundZero(rotationDiff - PI * 1.5)) {
            textBaseline = left ? 'top' : 'bottom';
            textAlign = 'center';
        }
        else {
            textBaseline = 'middle';

            if (rotationDiff < PI * 1.5 && rotationDiff > PI / 2) {
                textAlign = left ? 'right' : 'left';
            }
            else {
                textAlign = left ? 'left' : 'right';
            }
        }

        return {
            rotation: rotationDiff,
            textAlign: textAlign,
            textBaseline: textBaseline
        };
    }

    /**
     * @inner
     */
    function ifIgnoreOnTick(axis, i, interval) {
        return axis.scale.type === 'ordinal'
            && (typeof interval === 'function')
                && !interval(i, axis.scale.getLabel(i))
                || i % (interval + 1);
    }

    /**
     * @inner
     */
    function getInterval(model, opt) {
        var interval = model.get('interval');
        if (interval == null || interval == 'auto') {
            interval = opt.labelInterval;
        }
        return interval;
    }

    /**
     * @inner
     */
    function isAroundZero(val) {
        return val > -EPSILON && val < EPSILON;
    }

    /**
     * @inner
     */
    function remRadian(radian) {
        // To 0 - 2 * PI, considering negative radian.
        return (radian % PI2 + PI2) % PI2;
    }

    return AxisBuilder;

});