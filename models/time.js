const mongoose = require("mongoose");

const TimerSchema = new mongoose.Schema({
  email: { type: String, required: true },
  loginLogoutTimes: [
    {
      date: { type: String, default: null },
      loginTime: { type: Date, default: null },
      logoutTime: { type: Date, default: null },
    },
  ],
});

// module.exports = mongoose.model("time", TimerSchema);
const TimerModel = mongoose.model("time", TimerSchema);
module.exports = TimerModel;
