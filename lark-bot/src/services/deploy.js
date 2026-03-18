/**
 * GitHub 部署服务
 * 用于触发网站重新部署
 */

const axios = require('axios');

class GitHubDeployer {
  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    this.owner = process.env.GITHUB_OWNER;
    this.repo = process.env.GITHUB_REPO;
    this.baseURL = 'https://api.github.com';
  }

  /**
   * 触发 GitHub Actions 工作流部署
   */
  async deploy(branch = 'main') {
    if (!this.token || !this.owner || !this.repo) {
      throw new Error('GitHub 配置不完整，请检查 GITHUB_TOKEN、GITHUB_OWNER、GITHUB_REPO');
    }

    try {
      // 获取仓库信息
      const repoInfo = await this.getRepoInfo();

      // 尝试触发 GitHub Actions 工作流
      try {
        const workflowResult = await this.triggerWorkflow(branch);
        return {
          success: true,
          method: 'github-actions',
          url: repoInfo.html_url,
          branch,
          workflow: workflowResult,
          message: '部署已触发，请查看 GitHub Actions 状态',
        };
      } catch (workflowError) {
        // 如果没有配置 Actions，尝试其他部署方式
        console.log('Workflow trigger failed, trying alternative methods...');

        // 检查是否使用 GitHub Pages
        const pagesInfo = await this.getPagesInfo();
        if (pagesInfo) {
          return {
            success: true,
            method: 'github-pages',
            url: pagesInfo.html_url || repoInfo.html_url,
            branch,
            pages: pagesInfo,
            message: 'GitHub Pages 站点已配置，最新提交将自动部署',
          };
        }

        // 如果都没有，返回仓库信息
        return {
          success: true,
          method: 'manual',
          url: repoInfo.html_url,
          branch,
          message: '请手动部署网站，或使用 GitHub Actions/Pages 配置自动部署',
        };
      }
    } catch (error) {
      throw new Error(`部署失败: ${error.message}`);
    }
  }

  /**
   * 获取仓库信息
   */
  async getRepoInfo() {
    const response = await axios.get(
      `${this.baseURL}/repos/${this.owner}/${this.repo}`,
      {
        headers: {
          Authorization: `token ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    return response.data;
  }

  /**
   * 获取 GitHub Pages 信息
   */
  async getPagesInfo() {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${this.owner}/${this.repo}/pages`,
        {
          headers: {
            Authorization: `token ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Pages 未启用
      }
      throw error;
    }
  }

  /**
   * 触发 GitHub Actions 工作流
   */
  async triggerWorkflow(branch = 'main', workflowId = 'deploy.yml') {
    try {
      // 尝试触发指定工作流
      const response = await axios.post(
        `${this.baseURL}/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/dispatches`,
        {
          ref: branch,
        },
        {
          headers: {
            Authorization: `token ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      return {
        triggered: true,
        workflow: workflowId,
        branch,
        status: response.status,
      };
    } catch (error) {
      // 如果指定工作流不存在，尝试获取可用工作流列表
      if (error.response?.status === 404) {
        const workflows = await this.listWorkflows();

        if (workflows.length > 0) {
          // 尝试触发第一个可用的工作流
          const firstWorkflow = workflows[0];
          return await this.triggerWorkflow(branch, firstWorkflow.id);
        }

        throw new Error(
          `未找到部署工作流。可用工作流：${workflows.map(w => w.name).join(', ') || '无'}`
        );
      }

      throw error;
    }
  }

  /**
   * 列出可用的 GitHub Actions 工作流
   */
  async listWorkflows() {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${this.owner}/${this.repo}/actions/workflows`,
        {
          headers: {
            Authorization: `token ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      return response.data.workflows || [];
    } catch (error) {
      console.error('Failed to list workflows:', error.message);
      return [];
    }
  }

  /**
   * 获取最近的工作流运行记录
   */
  async getRecentRuns(limit = 5) {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${this.owner}/${this.repo}/actions/runs`,
        {
          headers: {
            Authorization: `token ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
          params: {
            per_page: limit,
          },
        }
      );

      return response.data.workflow_runs || [];
    } catch (error) {
      console.error('Failed to get recent runs:', error.message);
      return [];
    }
  }
}

module.exports = { GitHubDeployer };
