import { ProfileField } from "@/components/ui/ProfileField";
import { DocumentExtractionReviewCard } from "@/components/ui/DocumentExtractionReviewCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { View } from "react-native";
import type { User } from "@/hooks/use-app-data";
import type { DocumentExtractionReview } from "@/services/documents/document-reader.service";
import type { EditableProfileSnapshot } from "@/components/pages/profile/profile-state-utils";

export function ProfileDocumentPanel({
  activeDocumentAnalysis,
  applyDocumentReview,
  borderClass,
  cardBgClass,
  dismissDocumentReview,
  documentReview,
  editData,
  handlePickTranscript,
  inputBgClass,
  isEditing,
  noDivider = false,
  noTopSpacing = false,
  responsiveSectionSpacing,
  secondaryTextClass,
  t,
  textClass,
  transcriptDisplayName,
  user,
}: {
  activeDocumentAnalysis: boolean;
  applyDocumentReview: () => Promise<void>;
  borderClass: string;
  cardBgClass: string;
  dismissDocumentReview: () => void;
  documentReview: DocumentExtractionReview | null | undefined;
  editData: EditableProfileSnapshot;
  handlePickTranscript: () => void;
  inputBgClass: string;
  isEditing: boolean;
  noDivider?: boolean;
  noTopSpacing?: boolean;
  responsiveSectionSpacing?: boolean;
  secondaryTextClass: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  textClass: string;
  transcriptDisplayName: (value: string | undefined) => string;
  user: User;
}) {
  return (
    <>
      <ProfileField
        responsiveSectionSpacing={responsiveSectionSpacing}
        noDivider={noDivider}
        noTopSpacing={noTopSpacing}
        type="upload"
        icon="upload-file"
        label={t("profile.transcript")}
        value={transcriptDisplayName(user.transcript)}
        isEditing={isEditing}
        editValue={transcriptDisplayName(editData.transcript)}
        onPress={handlePickTranscript}
        uploadText={t("profile.uploadTranscript")}
        emptyText={t("profile.notUploaded")}
        inputBgClass={inputBgClass}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      {activeDocumentAnalysis ? (
        <StatusBanner
          variant="info"
          title={t("general.loading")}
          message={t("profile.documentReaderAnalyzing")}
          className="mt-4"
        />
      ) : null}

      {documentReview ? (
        <View className="mt-4">
          <DocumentExtractionReviewCard
            title={t("profile.documentReaderReviewTitle")}
            subtitle={t("profile.documentReaderReviewSubtitle")}
            fileName={documentReview.fileName}
            confidenceText={
              typeof documentReview.confidence === "number"
                ? t("profile.documentReaderConfidence", {
                    confidence: documentReview.confidence,
                  })
                : null
            }
            emptyStateText={t("profile.documentReaderNoFields")}
            applyLabel={t("profile.documentReaderApply")}
            dismissLabel={t("profile.documentReaderDismiss")}
            currentValueLabel={t("profile.documentReaderCurrent")}
            suggestedValueLabel={t("profile.documentReaderSuggested")}
            confidenceLabel={t("profile.documentReaderConfidenceShort")}
            cardBgClass={cardBgClass}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            items={documentReview.items.map((item) => ({
              ...item,
              label: t(item.labelKey),
            }))}
            uncertainties={documentReview.uncertainties}
            onApply={() => {
              applyDocumentReview().catch(() => {});
            }}
            onDismiss={dismissDocumentReview}
          />
        </View>
      ) : null}
    </>
  );
}
