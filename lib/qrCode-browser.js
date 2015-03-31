var QrCode = function() {
};

QrCode.prototype.init = function() {
    if (this.qrcodelib) {
        return;
    }

    this.qrcodelib = new qrcodelib.qrcodedraw();
    this.canvasEl = document.createElement("canvas");
}

QrCode.prototype.draw = function(text, options, cb) {
    this.init();
    this.qrcodelib.draw(this.canvasEl, text, options, cb);
};

QrCode.prototype.toDataURL = function(text, options, cb) {
    this.draw(text, options, function(err, canvas) {
        if (err) {
            return cb ? cb(err) : null;
        }

        cb(null, canvas.toDataURL("image/jpeg"));
    });
};

module.exports = new QrCode();
