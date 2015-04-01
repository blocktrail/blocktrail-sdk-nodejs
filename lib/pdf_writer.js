var pdfWriter = function(options) {
    // we can't require jsPDF yet, so we're trusting on it being there
    if (typeof jsPDF === "undefined") {
        throw new Error("jsPDF not found");
    }

    this.doc = new jsPDF('portrait', 'pt', 'letter');

    this.docWidth = 612;
    this.margin = typeof options.margin !== "undefined" ? options.margin : 30;
    this.bodyWidth = 612 - (this.margin * 2);
    this.yPos = 0;

    this.fontSize = [
        14
    ];
    this.lineMargin = [
        [2, 2]
    ];
    this.textColor = [
        [0, 0, 0]
    ];
    this.font = [
        'helvetica'
    ];
};

pdfWriter.prototype.setFont = function(font, cb) {
    this.font.push(font);
    this.doc.setFont(this.font[this.font.length -1 ]);

    if (cb) {
        cb();
    }

    this.font.pop();
    this.doc.setFont(this.font[this.font.length -1 ]);
};

pdfWriter.prototype.setFontSize = function(size, lineMargin, cb) {
    this.fontSize.push(size);
    this.lineMargin.push(lineMargin);
    this.doc.setFontSize(this.fontSize[this.fontSize.length -1 ]);

    if (cb) {
        cb();
    }

    this.fontSize.pop();
    this.lineMargin.pop();
    this.doc.setFontSize(this.fontSize[this.fontSize.length -1 ]);
};

pdfWriter.prototype.setTextColor = function(color, cb) {
    this.textColor.push(color);
    this.doc.setTextColor.apply(this.doc, this.textColor[this.textColor.length -1 ]);

    if (cb) {
        cb();
    }

    this.textColor.pop();
    this.doc.setTextColor.apply(this.doc, this.textColor[this.textColor.length -1 ]);
};

pdfWriter.prototype.TEXT = function(text, leftOffset, autoY, cb) {
    var self = this;

    if (typeof leftOffset === "function") {
        cb = leftOffset;
        leftOffset = null;
    } else if (typeof autoY === "function") {
        cb = autoY;
        autoY = null;
    }

    if (typeof autoY === "undefined" || autoY === null) {
        autoY = true;
    }

    var lines = self.doc.splitTextToSize(text, self.bodyWidth * 2);

    if (autoY) {
        var currentSize = self.fontSize[self.fontSize.length -1 ];
        var currentLineMargin = self.lineMargin[self.lineMargin.length -1 ];

        lines.forEach(function(line) {
            self.YAXIS(currentLineMargin[0]);
            self.YAXIS(currentSize);
            self.doc.text(line, self.margin + (leftOffset || 0), self.yPos);
            self.YAXIS(currentLineMargin[1]);
        });
    } else {
        self.doc.text(lines, self.margin + (leftOffset || 0), self.yPos);
    }

    if (cb) {
        cb();
    }
};

pdfWriter.prototype.HR = function(xOffset, yOffset) {
    var x1 = (xOffset || 0);
    var x2 = this.docWidth - this.margin - this.margin - (xOffset || 0);

    var y = (yOffset || 0);

    this.LINE(x1, y, x2, y);
};

pdfWriter.prototype.LINE = function(x1, y1, x2, y2) {
    this.doc.line(x1 + this.margin, y1 + this.yPos, x2 + this.margin, y2 + this.yPos);
};

pdfWriter.prototype.IMAGE = function(img, format, width, height, x) {
    x = (x || 0) + this.margin;
    var y = this.yPos;
    var w = width;
    var h = height;

    this.doc.addImage(img, format, x, y, w, h, undefined, 'none');
    this.YAXIS(h);
};

pdfWriter.prototype.YAXIS = function(y) {
    this.yPos += y || 0;
};

pdfWriter.prototype.NEXT_PAGE = function() {
    this.doc.addPage();
    this.yPos = 0;
};

pdfWriter.prototype.FONT_SIZE_HEADER = function(cb) { this.setFontSize(24, [12, 8], cb); };
pdfWriter.prototype.FONT_SIZE_SUBHEADER = function(cb) { this.setFontSize(18, [8, 5], cb); };
pdfWriter.prototype.FONT_SIZE_NORMAL = function(cb) { this.setFontSize(13, [2, 2], cb); };
pdfWriter.prototype.FONT_SIZE_SMALL = function(cb) { this.setFontSize(10, [2, 2], cb); };

pdfWriter.prototype.TEXT_COLOR_BLACK = function(cb) { this.setTextColor([0, 0, 0], cb); };
pdfWriter.prototype.TEXT_COLOR_GREY = function(cb) { this.setTextColor([51, 51, 51], cb); };
pdfWriter.prototype.TEXT_COLOR_RED = function(cb) { this.setTextColor([255, 0, 0], cb); };

module.export = pdfWriter;
