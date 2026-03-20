/**
 * Git 同步服务
 * 执行 Git add/commit/push 并触发部署
 */

const { execSync } = require('child_process');
const path = require('path');
const { GitHubDeployer } = require('./deploy');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

class GitSync {
  constructor() {
    this.deployer = new GitHubDeployer();
  }

  /**
   * 检查是否有变更
   */
  hasChanges() {
    try {
      const output = execSync('git status --porcelain', { cwd: PROJECT_ROOT, encoding: 'utf8' });
      return output.trim().length > 0;
    } catch (err) {
      console.error('检查 Git 状态失败:', err.message);
      return false;
    }
  }

  /**
   * 执行 Git 同步
   */
  async sync(importedCount) {
    if (!this.hasChanges()) {
      console.log('没有文件变更，跳过 Git 操作');
      return {
        success: true,
        hasChanges: false,
        message: '没有文件变更',
      };
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const commitMessage = importedCount > 1
        ? `sync: add ${importedCount} new articles ${today}`
        : `sync: add new article ${today}`;

      console.log('执行 Git add...');
      execSync('git add .', { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: 'inherit' });

      console.log('执行 Git commit...');
      execSync(`git commit -m "${commitMessage}"`, { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: 'inherit' });

      console.log('执行 Git push...');
      execSync('git push origin master', { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: 'inherit' });

      console.log('Git 推送完成');

      // 触发 GitHub 部署
      const deployResult = await this.triggerDeploy();

      return {
        success: true,
        hasChanges: true,
        commitMessage,
        deployResult,
        message: `Git 推送成功，${deployResult.message}`,
      };
    } catch (err) {
      console.error('Git 同步失败:', err.message);
      return {
        success: false,
        hasChanges: true,
        error: err.message,
        message: `Git 同步失败: ${err.message}`,
      };
    }
  }

  /**
   * 触发 GitHub 部署
   */
  async triggerDeploy() {
    try {
      const result = await this.deployer.deploy('master');
      return result;
    } catch (err) {
      console.error('触发部署失败:', err.message);
      return {
        success: false,
        message: `触发部署失败: ${err.message}`,
      };
    }
  }

  /**
   * 获取当前分支
   */
  getCurrentBranch() {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8' });
      return branch.trim();
    } catch (err) {
      return 'unknown';
    }
  }

  /**
   * 获取最近一次提交
   */
  getLastCommit() {
    try {
      const hash = execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8' });
      const message = execSync('git log --pretty=format:"%s" -1', { cwd: PROJECT_ROOT, encoding: 'utf8' });
      return {
        hash: hash.trim(),
        message: message.trim(),
      };
    } catch (err) {
      return null;
    }
  }
}

module.exports = { GitSync };
