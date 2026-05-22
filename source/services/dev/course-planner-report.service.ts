import * as MailComposer from "expo-mail-composer";
import { writeTextToAppDirectory } from "@/services/storage/file-system-adapter.service";

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
  const createdAt = new Date().toISOString();
  const fileName = buildReportFileName(createdAt);
  const savedFile = await writeTextToAppDirectory({
    fileName,
    content: reportText,
    directory: COURSE_PLANNER_REPORT_DIR,
  });

  return {
    fileName,
    fileUri: savedFile.fileUri,
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
