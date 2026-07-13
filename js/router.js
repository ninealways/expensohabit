(function () {
  const routeForPage = {
    dashboard:'/dashboard',
    transactions:'/transactions',
    calendar:'/calendar',
    schedule:'/schedule',
    settings:'/settings',
    outflow:'/outflow',
    investments:'/investments',
    insights:'/insights',
    profile:'/profile',
    habits:'/habits',
    habitInsights:'/habit-insights',
    habitManage:'/habit-manage',
    habitCheckins:'/habit-checkins'
  };
  const pageForRoute = Object.entries(routeForPage).reduce((acc, [page, route]) => {
    acc[route] = page;
    return acc;
  }, { '/':'dashboard' });

  function pageFromLocation() {
    return pageForRoute[window.location.pathname] || 'dashboard';
  }

  function push(page) {
    const route = routeForPage[page];
    if (route && window.location.pathname !== route) window.history.pushState({ page }, '', route);
  }

  window.ExpensoRouter = { routeForPage, pageForRoute, pageFromLocation, push };
})();
