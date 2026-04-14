const AutoApplyCredit = require("../schemas/AutoApplyCreditSchema");

class AutoApplyCreditModel {
  constructor(db) {
    this.db = db;
    this.collection = AutoApplyCredit;
  }
}

module.exports = AutoApplyCreditModel;
