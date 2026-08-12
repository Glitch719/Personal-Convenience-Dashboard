// Entry point. This is the only script the HTML loads. It pulls in each
// widget's init function and starts them, each inside its own safety net
// so one widget failing to start can't stop the others.

import { runSafely } from "./utils.js";
import { initTheme }   from "./widgets/theme.js";
import { initGreeting } from "./widgets/greeting.js";
import { initClock }    from "./widgets/clock.js";
import { initWeather }  from "./widgets/weather.js";
import { initTasks }    from "./widgets/tasks.js";
import { initReminders } from "./widgets/reminders.js";
import { initGrocery }  from "./widgets/grocery.js";
import { initFocus }    from "./widgets/focus.js";
import { initExpenses } from "./widgets/expenses.js";
import { initHabits }   from "./widgets/habits.js";
import { initLinks }    from "./widgets/links.js";
import { initCalendar } from "./widgets/calendar.js";
import { initNews }     from "./widgets/news.js";
import { initSummary }  from "./widgets/summary.js";
import { initSettings } from "./widgets/settings.js";

runSafely("theme",     initTheme);
runSafely("greeting",  initGreeting);
runSafely("clock",     initClock);
runSafely("weather",   initWeather);
runSafely("tasks",     initTasks);
runSafely("reminders", initReminders);
runSafely("grocery",   initGrocery);
runSafely("focus",     initFocus);
runSafely("expenses",  initExpenses);
runSafely("habits",    initHabits);
runSafely("links",     initLinks);
runSafely("calendar",  initCalendar);
runSafely("news",      initNews);
runSafely("summary",   initSummary);   // last widget: others publish before it first reads
runSafely("settings",  initSettings);  // controls which of the above are shown
