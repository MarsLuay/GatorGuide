import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import { STARTER_OPPORTUNITIES } from "@/constants/starter-opportunities";
import {
  OPPORTUNITY_STATUSES,
  type Opportunity,
} from "@/constants/opportunities";
import { useAppData } from "@/hooks/use-app-data";
import { useOpportunities } from "@/hooks/use-opportunities";
import {
  OpportunityGatewayError,
  opportunityGatewayService,
  type OpportunityAdminAccessResponse,
} from "@/services/opportunities/opportunity-gateway.service";
import { buildScholarshipExportFile } from "@/services/opportunities/scholarship-export.service";
import { saveTextFileForUser } from "@/services/storage/file-system-adapter.service";
import {
  buildDraftFromOpportunity,
  buildSaveInput,
  createBlankDraft,
  validateOpportunityAdminDraft,
  type OpportunityAdminDraft,
} from "@/components/pages/opportunity-admin/opportunity-admin-draft";

export function useOpportunityAdminController() {
  const { state } = useAppData();
  const { opportunities, refreshOpportunities, isRefreshing } = useOpportunities();
  const [query, setQuery] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OpportunityAdminDraft>(() => createBlankDraft());
  const [access, setAccess] = useState<OpportunityAdminAccessResponse | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isExportingScholarships, setIsExportingScholarships] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  const starterIds = useMemo(
    () => new Set(STARTER_OPPORTUNITIES.map((item) => item.opportunityId)),
    []
  );
  const signedInUser = state.user && !state.user.isGuest ? state.user : null;
  const scholarshipExportPreview = useMemo(
    () => buildScholarshipExportFile([...STARTER_OPPORTUNITIES, ...opportunities]),
    [opportunities]
  );

  const selectedOpportunity = useMemo(
    () =>
      selectedOpportunityId
        ? opportunities.find((item) => item.opportunityId === selectedOpportunityId) ?? null
        : null,
    [opportunities, selectedOpportunityId]
  );

  const filteredOpportunities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return opportunities;
    return opportunities.filter((opportunity) =>
      [
        opportunity.title,
        opportunity.organizationName,
        opportunity.summary,
        opportunity.opportunityId,
        opportunity.type,
        opportunity.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [opportunities, query]);

  const canDeleteSelected =
    !!selectedOpportunity &&
    selectedOpportunity.source.kind === "manual" &&
    !starterIds.has(selectedOpportunity.opportunityId);

  const loadAccess = useCallback(async () => {
    if (!signedInUser) {
      setAccess(null);
      setAccessError("");
      setIsCheckingAccess(false);
      return;
    }

    setIsCheckingAccess(true);
    setAccessError("");
    try {
      const result = await opportunityGatewayService.getOpportunityAdminAccess();
      setAccess(result);
    } catch (error) {
      setAccess(null);
      setAccessError(
        error instanceof OpportunityGatewayError
          ? error.message
          : "Could not verify admin access."
      );
    } finally {
      setIsCheckingAccess(false);
    }
  }, [signedInUser]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const handleSelectOpportunity = useCallback((opportunity: Opportunity) => {
    setSelectedOpportunityId(opportunity.opportunityId);
    setDraft(buildDraftFromOpportunity(opportunity));
    setSaveMessage("");
  }, []);

  const handleCreateNew = useCallback(() => {
    setSelectedOpportunityId(null);
    setDraft(createBlankDraft());
    setSaveMessage("");
  }, []);

  const handleSave = useCallback(async () => {
    const validation = validateOpportunityAdminDraft(draft);
    if (!validation.isValid) {
      Alert.alert(validation.title, validation.message);
      return;
    }

    setIsSaving(true);
    setSaveMessage("");
    try {
      const response = await opportunityGatewayService.upsertManualOpportunity(
        buildSaveInput(draft)
      );
      await refreshOpportunities();
      setSelectedOpportunityId(response.opportunityId);
      setDraft((current) => ({
        ...current,
        opportunityId: response.opportunityId,
      }));
      setSaveMessage(
        response.created
          ? "Opportunity created and added to the Firebase catalog."
          : "Opportunity updated in the Firebase catalog."
      );
    } catch (error) {
      setSaveMessage(
        error instanceof OpportunityGatewayError
          ? error.message
          : "Opportunity save failed."
      );
    } finally {
      setIsSaving(false);
    }
  }, [draft, refreshOpportunities]);

  const handleArchive = useCallback(
    async (archived: boolean) => {
      if (!selectedOpportunityId) return;

      setIsSaving(true);
      setSaveMessage("");
      try {
        await opportunityGatewayService.archiveOpportunity(
          selectedOpportunityId,
          archived
        );
        await refreshOpportunities();
        setDraft((current) => ({
          ...current,
          status: archived ? OPPORTUNITY_STATUSES.archived : OPPORTUNITY_STATUSES.active,
        }));
        setSaveMessage(
          archived
            ? "Opportunity archived from the live catalog."
            : "Opportunity restored to the live catalog."
        );
      } catch (error) {
        setSaveMessage(
          error instanceof OpportunityGatewayError
            ? error.message
            : "Could not update archive status."
        );
      } finally {
        setIsSaving(false);
      }
    },
    [refreshOpportunities, selectedOpportunityId]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedOpportunityId || !canDeleteSelected) return;

    setIsSaving(true);
    setSaveMessage("");
    try {
      await opportunityGatewayService.deleteOpportunity(selectedOpportunityId);
      await refreshOpportunities();
      setSelectedOpportunityId(null);
      setDraft(createBlankDraft());
      setSaveMessage("Manual opportunity deleted from Firebase.");
    } catch (error) {
      setSaveMessage(
        error instanceof OpportunityGatewayError
          ? error.message
          : "Could not delete opportunity."
      );
    } finally {
      setIsSaving(false);
    }
  }, [canDeleteSelected, refreshOpportunities, selectedOpportunityId]);

  const handleExportScholarships = useCallback(async () => {
    const exportFile = buildScholarshipExportFile([
      ...STARTER_OPPORTUNITIES,
      ...opportunities,
    ]);

    if (!exportFile.scholarshipCount) {
      Alert.alert("No scholarships found", "There are no scholarship records to export yet.");
      return;
    }

    setIsExportingScholarships(true);
    setExportMessage("");

    try {
      const savedFile = await saveTextFileForUser({
        fileName: exportFile.fileName,
        content: exportFile.content,
        mimeType: "text/tab-separated-values;charset=utf-8",
      });

      if (savedFile.delivery === "filesystem") {
        Alert.alert(
          "Scholarship export ready",
          `${exportFile.fileName} was saved to app documents.`
        );
      }

      setExportMessage(
        `Exported ${exportFile.scholarshipCount} scholarships (${exportFile.legacyCount} legacy).`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not create the scholarship export.";
      setExportMessage(message);
      Alert.alert("Scholarship export failed", message);
    } finally {
      setIsExportingScholarships(false);
    }
  }, [opportunities]);

  const updateDraft = useCallback(
    <K extends keyof OpportunityAdminDraft>(key: K, value: OpportunityAdminDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
    },
    []
  );

  return {
    access,
    accessError,
    canDeleteSelected,
    draft,
    exportMessage,
    filteredOpportunities,
    handleArchive,
    handleCreateNew,
    handleDelete,
    handleExportScholarships,
    handleSave,
    handleSelectOpportunity,
    isCheckingAccess,
    isExportingScholarships,
    isRefreshing,
    isSaving,
    loadAccess,
    opportunities,
    query,
    refreshOpportunities,
    saveMessage,
    scholarshipExportPreview,
    selectedOpportunity,
    selectedOpportunityId,
    setQuery,
    signedInUser,
    updateDraft,
  };
}
