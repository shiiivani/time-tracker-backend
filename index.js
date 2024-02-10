const express = require("express");
const app = express();
const mongoose = require("mongoose");
const UserModel = require("./models/users");
const TimerModel = require("./models/time");
const cors = require("cors");

app.use(express.json());
app.use(cors());

mongoose.connect(
  "mongodb+srv://Shivani:Animation123@cluster0.hgn8jtf.mongodb.net/time-tracker?retryWrites=true&w=majority"
);

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  UserModel.findOne({ email: email }).then((user) => {
    if (user) {
      if (user.password === password) {
        res.json(user);
      } else {
        res.json("The Password is incorrect");
      }
    } else {
      res.json("User doesn't exist");
    }
  });
});

app.get("/getUser", async (req, res) => {
  try {
    const userEmail = req.headers.authorization;

    const result = await UserModel.findOne({
      email: userEmail,
    }).exec();

    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatDate(date) {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

app.post("/checkIn", async (req, res) => {
  try {
    const { email } = req.body;

    const currentDate = new Date();
    const date = formatDate(currentDate);
    const timestamp = currentDate.getTime();

    let userTime = await TimerModel.findOne({ email }).exec();
    if (!userTime) {
      // If user doesn't exist, create a new document
      userTime = new TimerModel({
        email,
        loginLogoutTimes: [{ date, loginTime: currentDate }],
      });
    } else {
      // Check if there is already an entry for the current day
      const existingEntryIndex = userTime.loginLogoutTimes.findIndex(
        (entry) => entry.date === date
      );
      if (existingEntryIndex !== -1) {
        // If entry for the current day exists, return an error
        return res.status(400).json("Already checked in for today.");
      } else {
        // If entry for the current day doesn't exist, add a new entry
        userTime.loginLogoutTimes.push({ date, loginTime: timestamp });
      }
    }

    await userTime.save();
    res.json("Login time saved successfully");
  } catch (error) {
    console.error("Error saving login time:", error);
    res.status(500).json("Internal Server Error");
  }
});

app.post("/checkOut", async (req, res) => {
  try {
    const { email } = req.body;
    const currentDate = new Date();
    const date = formatDate(currentDate);
    const timestamp = currentDate.getTime();

    let userTime = await TimerModel.findOne({ email }).exec();
    if (!userTime) {
      // If user doesn't exist, return an error
      return res.status(400).json("User not found");
    }

    // Check if there is an entry for the current day
    const entryIndex = userTime.loginLogoutTimes.findIndex(
      (entry) => entry.date === date
    );
    if (entryIndex !== -1) {
      // If entry for the current day exists, update the logout time
      userTime.loginLogoutTimes[entryIndex].logoutTime = timestamp;
    } else {
      // If entry for the current day doesn't exist, return an error
      return res.status(400).json("No login entry found for today.");
    }

    await userTime.save();
    res.json("Logout time saved successfully");
  } catch (error) {
    console.error("Error saving logout time:", error);
    res.status(500).json("Internal Server Error");
  }
});

app.get("/getCurrentData", async (req, res) => {
  try {
    const { email } = req.query;
    const currentDate = new Date();

    const userTime = await TimerModel.findOne(
      {
        email,
        "loginLogoutTimes.date": formatDate(currentDate),
      },
      {
        "loginLogoutTimes.$": 1, // Projection to fetch only the matched element
      }
    ).exec();

    if (userTime && userTime.loginLogoutTimes.length > 0) {
      res.json(userTime.loginLogoutTimes[0]); // Return the first (and only) matched element
    } else {
      res.status(404).json("User not found or no data for the current date");
    }
  } catch (error) {
    console.error("Error fetching user times:", error);
    res.status(500).json("Internal Server Error");
  }
});

app.get("/getFilteredData", async (req, res) => {
  try {
    const { email, month, year } = req.query;

    const startOfMonth = new Date(year, month - 1, 1); // Assuming month is 1-indexed
    const endOfMonth = new Date(year, month, 0);
    const data = await TimerModel.find({
      email,
      "loginLogoutTimes.loginTime": {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    }).exec();

    const responseData = data.map((doc) => ({
      email: doc.email,
      loginLogoutTimes: doc.loginLogoutTimes.filter((entry) => {
        const entryDate = new Date(entry.loginTime);
        return entryDate >= startOfMonth && entryDate <= endOfMonth;
      }),
    }));

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/getDataStorewise", async (req, res) => {
  try {
    const { store, month, year } = req.query;

    const startOfMonth = new Date(year, month - 1, 1); // Assuming month is 1-indexed
    const endOfMonth = new Date(year, month, 0);

    // Fetch all documents in TimerModel
    const data = await TimerModel.find({
      store,
      "loginLogoutTimes.loginTime": {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    }).exec();

    const responseData = data.map((doc) => ({
      email: doc.email,
      loginLogoutTimes: doc.loginLogoutTimes.filter((entry) => {
        const entryDate = new Date(entry.loginTime);
        return entryDate >= startOfMonth && entryDate <= endOfMonth;
      }),
    }));

    res.json(responseData);
  } catch (error) {
    // Handle errors if any occur during the process
    console.error("Error fetching all data:", error);
    res.status(500).json("Internal Server Error");
  }
});

app.put("/updateTime", async (req, res) => {
  try {
    const { store, date, updatedEntry } = req.body;
    // Find the document that matches the email and date
    const userTime = await TimerModel.findOne({
      store,
      "loginLogoutTimes.date": date,
    });
    if (userTime) {
      // Update the login and logout times for the specific day
      const entryIndex = userTime.loginLogoutTimes.findIndex(
        (entry) => entry.date === date
      );
      if (entryIndex !== -1) {
        // Only update loginTime if provided in updatedEntry
        if (updatedEntry.loginTime !== null) {
          userTime.loginLogoutTimes[entryIndex].loginTime =
            updatedEntry.loginTime;
        }

        // Only update logout time if provided in updatedEntry
        if (updatedEntry.logoutTime !== null) {
          userTime.loginLogoutTimes[entryIndex].logoutTime =
            updatedEntry.logoutTime;
        }

        await userTime.save();
        res.json({ message: "Login and logout times updated successfully" });
      } else {
        res
          .status(404)
          .json({ message: "Login entry not found for the specified date" });
      }
    } else {
      res
        .status(404)
        .json({ message: "User not found for the specified email and date" });
    }
  } catch (error) {
    console.error("Error updating login and logout times:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// app.post("/addMultipleObjects", async (req, res) => {
//   try {
//     const startOfYear = new Date("2023-12-01T00:00:00Z");
//     const endOfYear = new Date("2023-12-31T23:59:59Z");

//     // Generate objects for each day of January 2024
//     const loginLogoutTimes = [];
//     for (let i = 1; i <= 31; i++) {
//       const date = `${i.toString().padStart(2, "0")}/12/2023`;
//       const loginTime = `2023-12-${i
//         .toString()
//         .padStart(2, "0")}T04:00:00.000Z`;
//       const logoutTime = `2023-12-${i
//         .toString()
//         .padStart(2, "0")}T11:44:23.182Z`;

//       loginLogoutTimes.push({
//         date,
//         loginTime,
//         logoutTime,
//       });
//     }

//     // Update the document with the new objects
//     const result = await TimerModel.updateOne({
//       $push: { loginLogoutTimes: { $each: loginLogoutTimes } },
//     });

//     res.json(result);
//   } catch (error) {
//     console.error("Error adding multiple objects:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

app.listen(3001, () => {
  console.log("Server Running");
});
