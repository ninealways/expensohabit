(function () {
  let activeApiRequests = 0;
  const nativeFetch = window.fetch.bind(window);

  function requestMessage(init = {}) {
    const method = String(init.method || 'GET').toUpperCase();
    if (method === 'GET') return 'Loading the latest data...';
    if (method === 'DELETE') return 'Deleting and syncing...';
    return 'Saving and syncing...';
  }

  function setLoading(isLoading, message = 'Waiting for the latest data...') {
    const loader = document.querySelector('#appLoader');
    const messageNode = document.querySelector('#loaderMessage');
    if (!loader || !messageNode) return;
    messageNode.textContent = message;
    loader.hidden = !isLoading;
    document.body.classList.toggle('is-loading', isLoading);
  }

  function installFetchLoader() {
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      const showLoader = String(url).includes('/api/');
      if (showLoader) {
        activeApiRequests += 1;
        setLoading(true, requestMessage(init));
      }
      try {
        return await nativeFetch(input, init);
      } finally {
        if (showLoader) {
          activeApiRequests = Math.max(0, activeApiRequests - 1);
          if (!activeApiRequests) setLoading(false);
        }
      }
    };
  }

  window.ExpensoApi = { installFetchLoader, setLoading };
})();
