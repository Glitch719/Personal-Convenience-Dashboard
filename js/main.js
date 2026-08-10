// Entry point. This is the only script the HTML loads. It pulls in each
// widget's init function and starts them, each inside its own safety net
// so one widget failing to start can't stop the others.

import { runSafely } from "./utils.js";
import { initGreeting } from "./widgets/greeting.js";
import { initClock }    from "./widgets/clock.js";
import { initWeather }  from "./widgets/weather.js";
import { initTasks }    from "./widgets/tasks.js";
import { initReminders } from "./widgets/reminders.js";

runSafely("greeting",  initGreeting);
runSafely("clock",     initClock);
runSafely("weather",   initWeather);
runSafely("tasks",     initTasks);
runSafely("reminders", initReminders);
