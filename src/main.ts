import * as core from '@actions/core';
import * as github from '@actions/github';
import {context} from '@actions/github';
import {
  getTagSHA,
  updateTag,
  validateIfReleaseIsPublished,
  postMessageToSlack
} from './api-utils';
import {
  validateSemverVersionFromTag,
  getMajorTagFromFullTag
} from './version-utils';

async function run(): Promise<void> {
  try {
    const token = core.getInput('token');
    const octokitClient = github.getOctokit(token);
    const sourceTagName = core.getInput('source-tag');

    validateSemverVersionFromTag(sourceTagName);

    await validateIfReleaseIsPublished(sourceTagName, octokitClient);

    const sourceTagSHA = await getTagSHA(sourceTagName, octokitClient);
    const majorTag = getMajorTagFromFullTag(sourceTagName);
    const doUpdate = core.getBooleanInput('update-tag');

    core.setOutput('sha', sourceTagSHA);
    core.setOutput('major-tag', majorTag);

    if (doUpdate) {
      await updateTag(sourceTagSHA, sourceTagName, majorTag, octokitClient);

      core.info(
        `The '${majorTag}' major tag now points to the '${sourceTagName}' tag`
      );

      const slackMessage = `The ${majorTag} tag has been successfully updated for the ${context.repo.repo} action to include changes from ${sourceTagName}`;
      await reportStatusToSlack(slackMessage);
    } else {
      core.info(
        `The '${majorTag}' major tag update to '${sourceTagName}' was skipped`
      );
    }
  } catch (error) {
    core.setFailed((error as Error).message);

    const slackMessage = `Failed to update a major tag for the ${context.repo.repo} action`;
    await reportStatusToSlack(slackMessage);
  }
}

async function reportStatusToSlack(message: string): Promise<void> {
  const slackWebhook = core.getInput('slack-webhook');
  if (slackWebhook) {
    await postMessageToSlack(slackWebhook, message);
  }
}

run();
