import * as FileSystem from "expo-file-system";
import * as MailComposer from "expo-mail-composer";

export type CoursePlannerBugReportFile = {
  fileName: string;
  fileUri: string;
  relativePath: string;
};

export type CoursePlannerBugReportResult = {
  status: "composed" | "unavailable";
  attachment?: CoursePlannerBugReportFile;
};

const COURSE_PLANNER_REPORT_DIR = "source/logs";

function buildReportFileName(createdAt: string) {
  return `course-planner-bug-report-${createdAt.replace(/[:.]/g, "-")}.txt`;
}

async function writeReportAttachment(reportText: string): Promise<CoursePlannerBugReportFile> {
  const baseDir = (FileSystem as any).documentDirectory ?? (FileSystem as any).cacheDirectory ?? "";
  if (!baseDir) {
    throw new Error("No writable directory is available for the course planner report.");
  }

  const createdAt = new Date().toISOString();
  const fileName = buildReportFileName(createdAt);
  const dir = `${baseDir}${COURSE_PLANNER_REPORT_DIR}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const fileUri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, reportText, { encoding: "utf8" });

  return {
    fileName,
    fileUri,
    relativePath: `${COURSE_PLANNER_REPORT_DIR}/${fileName}`,
  };
}

async function composeBugReportEmail(options: {
  recipient: string;
  subject: string;
  body: string;
  reportText: string;
}): Promise<CoursePlannerBugReportResult> {
  const isAvailable = await MailComposer.isAvailableAsync().catch(() => false);
  if (!isAvailable) {
    return { status: "unavailable" };
  }

  const attachment = await writeReportAttachment(options.reportText);
  await MailComposer.composeAsync({
    recipients: [options.recipient],
    subject: options.subject,
    body: options.body,
    attachments: [attachment.fileUri],
  });

  return {
    status: "composed",
    attachment,
  };
}

export const coursePlannerReportService = {
  logDirectory: COURSE_PLANNER_REPORT_DIR,
  composeBugReportEmail,
};
