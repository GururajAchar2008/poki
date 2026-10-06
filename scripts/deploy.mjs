import { execFileSync, execSync } from "node:child_process";

const run = (command, args) => {
  execFileSync(command, args, { stdio: "inherit" });
};

console.log("Building Poki for production...");
execSync("npm run build", { stdio: "inherit" });

console.log("Preparing the GitHub Pages deployment commit...");
run("git", ["add", "-A"]);

const hasChanges = (() => {
  try {
    execFileSync("git", ["diff", "--cached", "--quiet"], { stdio: "ignore" });
    return false;
  } catch {
    return true;
  }
})();

if (!hasChanges) {
  console.log(
    "No source changes to deploy. GitHub Pages is already up to date.",
  );
  process.exit(0);
}

run("git", ["commit", "-m", "deploy frontend"]);
run("git", ["push", "origin", "main"]);
console.log(
  "Deployment pushed. GitHub Actions will publish the frontend to Pages.",
);
