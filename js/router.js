(function () {
  const routeForPage = {
    dashboard:'/dashboard',
    transactions:'/transactions',
    creditCard:'/credit-card',
    calendar:'/calendar',
    schedule:'/schedule',
    settings:'/settings',
    outflow:'/outflow',
    investments:'/investments',
    insights:'/insights',
    profile:'/profile',
    guide:'/guide',
    habits:'/habits',
    habitManage:'/habit-manage',
    habitCheckins:'/habit-checkins',
    timeline:'/timeline'
  };
  const pageForRoute = Object.entries(routeForPage).reduce((acc, [page, route]) => {
    acc[route] = page;
    return acc;
  }, { '/':'dashboard' });

  function pageFromLocation() {
    if (window.location.pathname === '/habit-insights') {
      window.history.replaceState({ page:'habits' }, '', routeForPage.habits);
      return 'habits';
    }
    return pageForRoute[window.location.pathname] || 'dashboard';
  }

  function push(page) {
    const route = routeForPage[page];
    if (route && window.location.pathname !== route) window.history.pushState({ page }, '', route);
  }

  window.ExpensoRouter = { routeForPage, pageForRoute, pageFromLocation, push };
})();
