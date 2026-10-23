const path = require('node:path');
const fs = require('node:fs');
const cli = path.join(process.env.APPDATA, 'npm/node_modules/eas-cli/build');
const SessionManager = require(path.join(cli, 'user/SessionManager.js')).default;
const { createGraphqlClient } = require(path.join(cli, 'commandUtils/context/contextUtils/createGraphqlClient.js'));
const { SubmissionQuery } = require(path.join(cli, 'graphql/queries/SubmissionQuery.js'));

async function main() {
  const session = new SessionManager();
  const accessToken = session.getAccessToken();
  const sessionSecret = session.getSessionSecret();
  if (!accessToken && !sessionSecret) throw new Error('Existing Expo login is unavailable');
  const client = createGraphqlClient({ accessToken, sessionSecret });
  const result = [];
  for (const id of process.argv.slice(2)) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Expected an explicit upload ID');
    const upload = await SubmissionQuery.byIdAsync(client, id, { useCache: false });
    if (upload.app.id !== '5c765c38-7e1b-4b4c-9f50-5187865a7235') throw new Error('Wrong Expo project');
    if (String(upload.iosConfig.ascAppIdentifier) !== '6823244099') throw new Error('Wrong Apple destination');
    const details = await client.query(`
      query UploadProgress($submissionId: ID!) {
        submissions {
          byId(submissionId: $submissionId) {
            createdAt
            updatedAt
            completedAt
            priority
            submittedBuild { id }
            childSubmission { id status }
            jobRun {
              id status createdAt enqueuedAt startedAt endedAt
              errors { errorCode message }
            }
          }
        }
      }`, { submissionId: id }, { requestPolicy: 'network-only' }).toPromise();
    if (details.error) throw new Error(details.error.message);
    const progress = details.data.submissions.byId;
    result.push({
      id,
      status: upload.status,
      error: upload.error,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
      completedAt: progress.completedAt,
      priority: progress.priority,
      buildId: progress.submittedBuild?.id ?? null,
      childSubmission: progress.childSubmission,
      worker: progress.jobRun,
      logFileCount: upload.logFiles.length
    });
  }
  fs.writeFileSync('artifacts/apple-upload-status.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
