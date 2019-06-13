var PinBoard = function (stage) {
  this.pinotes = [];
  this.pinboard = PiNote.getContainer();
  this.stage = stage;
  this.prevSelected = null;
  this.currSelected = null;
};

PinBoard.prototype = {
  constructor: PinBoard,

  update: function () {
    for (var i=0; i<this.pinotes.length; i++) {
      this.pinotes[i].update();
    }
  },

  add: function (params) {
    params.color = params.color.replace("#", "0x");
    var pinote = new PiNote(this.stage, this, params);
    this.pinboard.addChild(pinote.note);
    this.pinotes.push(pinote);
    this.prevSelected = this.currSelected;
    this.currSelected = pinote;
  },

  clear: function () {
    this.pinboard.removeChildren();
    this.pinotes = [];
  },

  swapNotes: function (current) {
    this.prevSelected = this.currSelected;
    this.currSelected = current;
    this.pinboard.swapChildren(this.prevSelected.note, this.currSelected.note);
  },
}
