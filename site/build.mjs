import { cp, mkdir, rm } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const dist = new URL("./dist/", root);
const client = new URL("client/", dist);

await rm(dist, { recursive: true, force: true });
await Promise.all([
  mkdir(client, { recursive: true }),
  mkdir(new URL("server/", dist), { recursive: true }),
]);

await mkdir(new URL("fonts/", client), { recursive: true });
await Promise.all(
  [
    "index.html",
    "styles.css",
    "doem-mark.svg",
    "doem-lockup-light.svg",
    "doem-lockup-dark.svg",
    "fonts/Geist-Variable.woff2",
  ].map((file) =>
    cp(new URL(file, root), new URL(file, client)),
  ),
);
// Screenshots are added by a later step, so a missing media/ folder is fine.
await cp(new URL("media/", root), new URL("media/", client), { recursive: true }).catch((error) => {
  if (error.code !== "ENOENT") throw error;
});
await cp(new URL("worker/index.js", root), new URL("server/index.js", dist));
