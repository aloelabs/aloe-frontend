const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const execSyncWrapper = (command) => {
  let stdout = null;
  try {
    stdout = execSync(command);
  } catch (e) {
    console.error(e);
  }
  return stdout;
};

const main = () => {
  const gitBranch = execSyncWrapper('git rev-parse --abbrev-ref HEAD');
  const gitCommit = execSyncWrapper('git rev-parse HEAD');

  const gitInfo = {
    branch: gitBranch.toString().trim(),
    commit: gitCommit.toString().trim(),
  };

  const gitInfoPath = path.join(__dirname, '..', 'gitInfo.json');
  fs.writeFileSync(gitInfoPath, JSON.stringify(gitInfo));
  console.log('gitInfo.json created');
};

main();
