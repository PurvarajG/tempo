/** Serve Doem's prebuilt static assets through the Sites worker runtime. */
const worker = {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") url.pathname = "/index.html";

    return env.ASSETS.fetch(url.pathname === "/index.html" ? new Request(url) : request);
  },
};

export default worker;
