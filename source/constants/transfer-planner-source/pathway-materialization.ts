import type {
  TransferPlannerLink,
  TransferPlannerMajorPathway,
  TransferPlannerMajorPlan,
} from "../transfer-planner-types";
import type { TransferPlannerParsedRequirementSourceBlock } from "./schema";
import { TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS } from "./bootstrap.generated";
import { TRANSFER_PLANNER_PRIMARY_PROMOTIONS } from "./primary-source-promotions.generated";
import {
  buildTransferPlannerOwnerId,
  normalizeTransferPlannerPathwayId,
} from "./pathway-id-normalization";
import {
  hasTransferPlannerHtmlEntityLeak,
  labelMentionsDifferentTransferPlannerMajor,
  normalizeTransferPlannerText,
  normalizeTransferPlannerSemanticPathwayLabel,
  stripTransferPlannerPlanTitlePrefix,
} from "./pathway-title-normalization";

export type TransferPlannerDerivedPathwaySeed = {
  id: string;
  label: string;
  summary: string;
  officialLinks?: TransferPlannerLink[];
};

const DERIVED_PATHWAY_LABEL_PATTERN =
  /\b(track|option|route|pathway|certificate|concentration)\b/i;
const DERIVED_PATHWAY_KIND_PATTERN =
  /\b(track|option|route|pathway|certificate|concentration)\b/i;
const DERIVED_PATHWAY_EXPLICIT_COURSE_CODE_PATTERN =
  /\b[A-Z]{2,8}(?:\/[A-Z]{2,8})?\s+\d{3}(?:\.\d+)?[A-Z]?\b/i;
const DERIVED_PATHWAY_SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);
const DERIVED_PATHWAY_LINK_STOPWORDS = new Set([
  ...DERIVED_PATHWAY_SMALL_WORDS,
  "arts",
  "ba",
  "bachelor",
  "bs",
  "culture",
  "degree",
  "major",
  "media",
  "of",
  "option",
  "pathway",
  "program",
  "requirements",
  "route",
  "school",
  "studies",
  "tacoma",
  "track",
  "university",
  "uw",
  "washington",
]);

function uniqueDerivedPathwaySourceLinks(links: TransferPlannerLink[]) {
  return Array.from(
    new Map(
      links.map((link) => [`${link.url}||${link.label}||${link.note ?? ""}`, link])
    ).values()
  );
}

function buildDerivedPathwaySourceLinkTokens(...values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) =>
          normalizeTransferPlannerText(value)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .split(/\s+/)
        )
        .filter(
          (token) =>
            token.length >= 2 && !DERIVED_PATHWAY_LINK_STOPWORDS.has(token)
        )
    )
  );
}

function derivedPathwaySourceTokenMatches(token: string, candidateTokens: Set<string>) {
  return (
    candidateTokens.has(token) ||
    (token.endsWith("ies") && candidateTokens.has(`${token.slice(0, -3)}y`)) ||
    (token.endsWith("s") && token.length > 3 && candidateTokens.has(token.slice(0, -1)))
  );
}

function isDerivedPathwaySpecificSourceLink(link: TransferPlannerLink) {
  return DERIVED_PATHWAY_KIND_PATTERN.test(`${link.label} ${link.url}`);
}

function sourceLinkMatchesDerivedPathway(
  link: TransferPlannerLink,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const pathwayTokens = buildDerivedPathwaySourceLinkTokens(pathway.id, pathway.label);
  if (!pathwayTokens.length) {
    return false;
  }

  const linkTokens = new Set(
    buildDerivedPathwaySourceLinkTokens(link.label, link.url, link.note)
  );
  return pathwayTokens.every((token) =>
    derivedPathwaySourceTokenMatches(token, linkTokens)
  );
}

function getDerivedPathwayOfficialLinks(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const officialLinks = plan.officialLinks ?? [];
  const pathwaySpecificLinks = officialLinks.filter(isDerivedPathwaySpecificSourceLink);
  const matchingPathwayLinks = pathwaySpecificLinks.filter((link) =>
    sourceLinkMatchesDerivedPathway(link, pathway)
  );

  if (matchingPathwayLinks.length) {
    return uniqueDerivedPathwaySourceLinks(matchingPathwayLinks);
  }

  const matchingOwnerLinks = officialLinks.filter((link) =>
    sourceLinkMatchesDerivedPathway(link, pathway)
  );
  if (matchingOwnerLinks.length) {
    return uniqueDerivedPathwaySourceLinks(matchingOwnerLinks);
  }

  return pathwaySpecificLinks.length ? [] : officialLinks;
}
const PATHWAY_CHOICE_COUNT_BY_WORD = new Map([
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);
const DERIVED_PATHWAY_ACRONYMS = new Set([
  "CECL",
  "BA",
  "BS",
  "ELL",
  "ESOL",
  "GIS",
  "IAC",
  "LEDE",
  "MA",
  "MIS",
  "MS",
  "NME",
  "PIA",
  "TIM",
  "UW",
]);
const DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS = [
  /^(?:option|track|route|pathway|certificate|concentration)$/i,
  /^students?\b.*\b(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^classes?\s+in\s+this\b.*\b(?:option|track|route|pathway|certificate|concentration)\b.*\boffered\b/i,
  /^the\b.*\b(?:option|track|route|pathway|certificate|concentration)\b.*\b(?:provides|emphasizes|requires)\b/i,
  /^the\b.*\b(?:option|track|route|pathway|certificate|concentration)\b.*\b(?:is|prepares)\b/i,
  /^the\b.*\b(?:option|track|route|pathway|certificate|concentration)\b.*\b(?:will\s+)?(?:thoroughly\s+)?prepare\b/i,
  /^if you enrolled\b.*\b(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^if\s+adding\b.*\b(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^and\b.*\b(?:option|track|route|pathway|certificate|concentration)\b.*\b(?:is|prepares)\b/i,
  /^\d+\s+of\s+the\s+\d+\s+credits?\s+required\s+for\s+the\s+(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^\(?\d+\)?\s+second\b.*\blanguage\b.*\bconcentration\b/i,
  /^courses by track$/i,
  /\bchoose from the following\b/i,
  /^doctor(?:\s+of)?\b/i,
  /^ph\.?\s*d\.?\b/i,
  /^p\.?\s*h\.?\s*d\.?\b/i,
  /\bnot admitting\b/i,
  /^a minor\b.*\bexplore the liberal arts\b/i,
  /^department must approve\b.*\boption\b/i,
  /^m\.?\s*ed\.?\b/i,
  /^teaching track$/i,
  /^with the option to\b/i,
  /^and\b.*\b(?:option|track|route|pathway|certificate|concentration)$/i,
  /^according to the option chosen\b/i,
  /^additional (?:admission|completion )?requirements?\b/i,
  /^advanced data science option specific requirements?\b/i,
  /^admission under\b/i,
  /^after completing\b.*\boption\b/i,
  /^all pathways\b/i,
  /^although\b.*\bconcentration areas?\b.*\binformal\b/i,
  /^an option$/i,
  /^and the concentration coordinator\b/i,
  /^a general description of\b.*\bconcentration\b/i,
  /^begin taking\b.*\boption classes\b/i,
  /^b\.?\s*s\.?\s+with\b.*\boption\b/i,
  /^budget analysts\b.*\boption\b/i,
  /^complete the requirements\b/i,
  /^clinical requirements?\b/i,
  /^concentration course numbers?\b/i,
  /^concentration electives?\b/i,
  /^concentration area courses?\b/i,
  /^concentration projects?\b/i,
  /^concentration\s+[ivxlcdm]+\b(?:\s+courses?)?(?:\s*[:.]?)?$/i,
  /^(?:optional\s+)?(?:concentration|focus)\s+areas?$/i,
  /^core courses?\b/i,
  /^course lists?\b/i,
  /^course[- ]only option\b/i,
  /^create your own pathway as a separate option\b/i,
  /^.{2,80}\bcurriculum option\b/i,
  /^curriculum and instruction\):/i,
  /^(?:examples of\s+)?coursework pathways?\b/i,
  /^degree options?\b/i,
  /^electives?\b.*\bchoose\b/i,
  /^capstone experience\b/i,
  /^capstone option\b/i,
  /^choose (?:one|two|three|between|from)\b/i,
  /^choose your\b/i,
  /^contact the\b/i,
  /^degree options?\b/i,
  /^declaring an option\b/i,
  /^declaring(?: the)?\b/i,
  /^declare your major option\b/i,
  /^download\b/i,
  /^explore\b.*\bconcentration areas?\b/i,
  /^electives for\b.*\boption\b/i,
  /^formal options?\b/i,
  /^followed by\b.*\boption\b/i,
  /^funding grad school\b/i,
  /\bfee[- ]based\b/i,
  /^gis resources at uw\b/i,
  /^graduation\b/i,
  /^home\b/i,
  /^how do i\b.*\bconcentration area\b/i,
  /^how to declare(?: the)?\b/i,
  /^including\b.*\boption\b/i,
  /^joining the\b/i,
  /^me option courses?\b/i,
  /^master(?:\s+of)?\b/i,
  /^marketing management to declare\b.*\bconcentration\b/i,
  /^.+\bcan also be taken as (?:an? )?(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^.+\blearn more about\b.*\b(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^may benefit from completing\b.*\btrack\b/i,
  /^minimum \d/i,
  /^listed below are .*coursework pathways?\b/i,
  /^non-me courses as me option\b/i,
  /^note:?\s+prerequisites? for option\b/i,
  /^\d{1,3}(?:-\d{1,3})?\s*credits?\b/i,
  /^\d{1,3}(?:-\d{1,3})?\s+credits?\s+depending on option\b/i,
  /^option and concentration curriculum\b/i,
  /^.{2,80}\boption:\s+.*electives?\b/i,
  /^option course numbers?\b/i,
  /^option courses?\b/i,
  /^option \d+\b/i,
  /^option-specific\b/i,
  /^or from\b.*\bconcentration\b/i,
  /^or course[- ]only option\b/i,
  /^other approved\b.*\belectives?\s+option\b/i,
  /^other\b.*\belectives?\s+option\b/i,
  /^additional\b.*\belectives?\s+option\b/i,
  /^page \d+\b/i,
  /^\(?\d+\)?\s*plan a pathway toward\b/i,
  /^planning\b.*\bdegree electives?\b.*\bconcentration area\b/i,
  /^please see\b.*\b(?:option page|courses? by track)\b/i,
  /^please check out\b/i,
  /^possible coursework pathways?\b/i,
  /^option[- ]specific\b/i,
  /^pathway[- ]specific\b/i,
  /^ph concentration projects?\b/i,
  /^requirements? to declare\b/i,
  /^required\b.*\boption courses?\b/i,
  /^see ["']?additional\b/i,
  /^see\b.*\b(?:option|track|concentration|pathway)\b/i,
  /^selection of\b.*\boption\b/i,
  /^specific areas covered within\b.*\boption\b/i,
  /^supplemental official\b/i,
  /^students?.*\bmust complete\b.*\bfor graduation\b/i,
  /^this track emphasizes\b/i,
  /^this option (?:also )?requires\b/i,
  /^this option explores\b/i,
  /^the courses in\b.*\boption\b.*\bcover topics such as\b/i,
  /^the rationale for\b.*\bconcentration\b/i,
  /^teaching track faculty\b/i,
  /^tenure track\b/i,
  /^to declare\b.*\b(?:option|concentration)\b/i,
  /^to propose\b.*\bconcentration\b/i,
  /^track[- ]specific\b/i,
  /^track specific\b/i,
  /^track-specific\b/i,
  /^upon completing\b.*\boption\b/i,
  /^you have the option to\b/i,
  /^gis certificate\b.*complete all\b/i,
  /^foundation courses?\b/i,
  /^gis certificate classes\b/i,
  /^in addition to\b/i,
  /^option breadth\b/i,
  /^option[- ]specific\b/i,
  /^program requirements?\b/i,
  /^program option$/i,
  /^plus\b/i,
  /^students declare\b/i,
  /^the curriculum consists\b/i,
  /^why choose\b/i,
  /^what is the difference\b.*\bconcentration area\b/i,
  /^who should choose\b/i,
  /^which is detailed at\b/i,
  /^senior electives?\b/i,
  /^topics option$/i,
  /^special projects?\b.*\b(?:graded option only|count toward the option)\b/i,
  /^to be considered\b.*\bpathway\b/i,
  /\bdouble major\b/i,
  /\bdouble degree\b/i,
  /\b(?:clinical|didactic) coursework\b/i,
  /\boption[- ]specific\b.*\b(?:credits?|requirements?|coursework)\b/i,
  /\b(?:option|track|concentration) course numbers?\b/i,
  /\b(?:option|track|concentration) courses?\b/i,
  /\bno longer accepting new students\b/i,
  /\bconcentration projects?$/i,
  /\bstudents? must complete\b.*\bfor graduation\b/i,
  /\btrack[- ]specific\b.*\b(?:credits?|requirements?|coursework)\b/i,
  /\btrack\s*\(addl\.\s*\d/i,
  /\btrack electives?\b/i,
  /\bdepending on (?:credential\/)?option\b/i,
  /\bvaries by option\b/i,
  /\bchoose thesis, project, or course-only option\b/i,
  /^for admission requirements\b.*\b(?:concentration|option|track|route|pathway)\b/i,
  /^for the\b.*\b(?:concentration|option|track|route|pathway)\b/i,
  /^(?:[†*§◊]+)?\s*if not taken\b.*\b(?:concentration|option|track|route|pathway)\b/i,
  /^concentration\s+[ivxlcdm]+\b.*\b(?:credits?|courses?)\b/i,
  /^(?:[â€ *Â§â—Š]+\s*)?route\.menu_active_trails:/i,
  /^(?:[â€ *Â§â—Š]+\s*)?route\.name\.is_layout_builder_ui\b/i,
  /^route\s+name\s+is\s+layout\s+builder\s+ui\b/i,
  /\bmenu[_-]?active[_-]?trails\b/i,
  /\blayout[_-]?builder[_-]?ui\b/i,
  /^you\b.*\b(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^they\b.*\b(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^and\b.*\b(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^extent and quality\b/i,
  /^credential overview\b/i,
  /^recommended preparation\b/i,
  /^with honors\b.*\bdepartmental honors\b.*\b(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^especially those who\b.*\bpathway\b/i,
  /\bcompletion of departmental honors requirements in the major\b/i,
];
const DERIVED_PATHWAY_STRUCTURAL_ID_PATTERNS = [
  /^(?:option|track|route|pathway|certificate|concentration)$/i,
  /^students?-.*-(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^classes?-in-this-.*-(?:option|track|route|pathway|certificate|concentration)-.*-offered\b/i,
  /^you-.*-(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^they-.*-(?:option|track|route|pathway|certificate|concentration)\b/i,
  /^.+-can-also-be-taken-as-(?:a|an)-(?:option|track|route|pathway|certificate|concentration)$/i,
  /^.+-learn-more-about-.*-(?:option|track|route|pathway|certificate|concentration)$/i,
  /^and-.*-(?:option|track|route|pathway|certificate|concentration)(?:-|$)/i,
  /^if-you-enrolled-.*-option\b/i,
  /^the-.*-(?:option|track|route|pathway|certificate|concentration)-.*-(?:is|prepares)\b/i,
  /^the-.*-(?:option|track|route|pathway|certificate|concentration)-.*-(?:will-)?(?:thoroughly-)?prepare\b/i,
  /^and-.*-(?:option|track|route|pathway|certificate|concentration)-.*-(?:is|prepares)\b/i,
  /^extent-and-quality\b/i,
  /^credential-overview-(?:option|track|route|pathway|certificate|concentration)$/i,
  /^recommended-preparation-(?:option|track|route|pathway|certificate|concentration)$/i,
  /^with-honors-.*departmental-honors.*-(?:option|track|route|pathway|certificate|concentration)$/i,
  /^especially-those-who-.*-pathway$/i,
  /^\d+-of-the-\d+-credits-required-for-the-concentration$/i,
  /^\d+-second-.*-language-.*-concentration$/i,
  /^courses-by-track$/i,
  /(?:^|[-:])choose-from-the-following(?:$|[-:])/i,
  /^doctor(?:-|$)/i,
  /^ph-?d(?:-|$)/i,
  /^p-h-d(?:-|$)/i,
  /(?:^|[-:])not-admitting(?:$|[-:])/i,
  /^a-minor-.*explore-the-liberal-arts$/i,
  /^department-must-approve.*option$/i,
  /^m-ed\b/i,
  /^teaching-track$/i,
  /^with-the-option-to\b/i,
  /^and-.*-(?:option|track|route|pathway|certificate|concentration)$/i,
  /^although-.*-concentration-areas-.*-informal$/i,
  /^b-s-with-.*-option$/i,
  /^bs-option-family:/i,
  /^\d+-.*choose-one-option\b/i,
  /^option-\d+\b/i,
  /^page-\d+\b/i,
  /(?:^|[-:])option-specific(?:$|[-:])/i,
  /(?:^|[-:])track-specific(?:$|[-:])/i,
  /(?:^|[-:])pathway-specific(?:$|[-:])/i,
  /(?:^|[-:])choose-one-option(?:$|[-:])/i,
  /(?:^|[-:])choose-your(?:$|[-:])/i,
  /(?:^|[-:])choose-one(?:$|[-:])/i,
  /(?:^|[-:])declaring-an-option(?:$|[-:])/i,
  /(?:^|[-:])declaring-the(?:$|[-:])/i,
  /(?:^|[-:])how-to-declare(?:$|[-:])/i,
  /(?:^|[-:])how-do-i(?:$|[-:])/i,
  /^explore-.*-concentration-areas?/i,
  /^planning-.*-degree-electives?.*-concentration-area/i,
  /^what-is-the-difference-.*-concentration-area/i,
  /(?:^|[-:])declaration-process(?:$|[-:])/i,
  /(?:^|[-:])concentration-electives?(?:$|[-:])/i,
  /(?:^|[-:])core-courses?(?:$|[-:])/i,
  /(?:^|[-:])program-requirements?(?:$|[-:])/i,
  /(?:^|[-:])requirements-to-declare(?:$|[-:])/i,
  /(?:^|[-:])see-additional(?:$|[-:])/i,
  /(?:^|[-:])depending-on(?:$|[-:])/i,
  /(?:^|[-:])varies-by(?:$|[-:])/i,
  /(?:^|[-:])minimum-\d/i,
  /^may-benefit-from-completing-.*-track$/i,
  /^\d{1,3}(?:-\d{1,3})?-credits/i,
  /(?:^|[-:])option-.*electives?(?:$|[-:])/i,
  /^see-.*-(?:option|track|concentration|pathway)$/i,
  /^choose-thesis-project-or-course-only-option/i,
  /^transfer-students-apply-for-admission-under-this-pathway/i,
  /^funding-grad-school-track$/i,
  /^gis-resources-at-uw-track$/i,
  /^graduation-track$/i,
  /^home-track$/i,
  /^including-.*-option$/i,
  /^other-approved-.*electives?-option$/i,
  /^other-.*electives?-option$/i,
  /^additional-.*electives?-option$/i,
  /^topics-option$/i,
  /^.+-\d+(?:-\d+)?-option$/i,
  /^.+-no-longer-accepting-new-students\b/i,
  /^senior-electives-pathway$/i,
  /^special-projects?.*(?:graded-option-only|count-toward-the-option)/i,
  /^to-be-considered-.*-pathway$/i,
  /^who-should-choose-.*-option$/i,
  /^route-menu-active-trails(?:$|[-:])/i,
  /^route-name-is-layout-builder-ui(?:$|[-:])/i,
];
const DERIVED_PATHWAY_GUIDANCE_LINE_PATTERNS = [
  /\bfor advice on choosing\b/i,
  /\bhelp students acquire and articulate\b/i,
  /\bmay benefit from completing\b/i,
  /\bmay combine various interests\b/i,
  /\bnot listed on the transcript\b/i,
  /\bnot meant to be the only pathway options\b/i,
  /\bplease check out\b/i,
  /\bwhich is detailed at\b/i,
];
const DERIVED_PATHWAY_DEGREE_TITLE_PATTERN =
  /^(?:(?:Bachelor|Master|Doctor|Minor|Associate)(?: of [^:]{1,120})?|(?:B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)(?: degree)?(?: with a major in [^:]{1,120})?)\s*:\s+(.{2,120})$/i;
const DERIVED_PATHWAY_UNDERGRAD_MAJOR_CREDENTIAL_PATTERN =
  /^(?:The\s+)?(Bachelor of Arts|Bachelor of Science|B\.?\s*A\.?|B\.?\s*S\.?)\s+(?:degree\s+)?(?:(?:with\s+a\s+major\s+)?in\s+|with\s+a\s+major\s+)(.{2,180}?)(?:\s*:\s+(.{2,120}))?$/i;
const DERIVED_PATHWAY_DEGREE_PARENTHESES_PATTERN =
  /^(?:(?:The\s+)?(?:Bachelor|Master|Doctor|Minor|Associate|B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)[^()]{0,120})\((.{2,100}\b(?:track|option|route|pathway|certificate|concentration))\)\s*$/i;
const DERIVED_PATHWAY_APPLY_DIRECTLY_PATTERN =
  /\bstudents apply(?: directly)?(?:\s+for|\s+to)?(?: the)?\s+(.{2,100}?)\s+(option|track|route|pathway|concentration)\b/i;
const DERIVED_PATHWAY_CREDENTIAL_PATTERN =
  /^the\s+(.{2,100}?)\s+option credential\b/i;
const DERIVED_PATHWAY_WITH_OPTION_IN_PATTERN =
  /^(?:(?:Bachelor|Master|Doctor|Minor|Associate)(?: of [^:]{1,120})?|(?:B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)(?: degree)?(?: with a major in [^:]{1,120})?)\s+with option in\s+(.{2,100})$/i;
const DERIVED_PATHWAY_LIST_LABEL_PATTERN =
  /^list [A-Z]\s*[-:]\s+(.{2,100})$/i;
const DERIVED_PATHWAY_STRUCTURAL_PREFIX_PATTERN =
  /^(.{2,80}?)\s+(option|track|route|pathway|certificate|concentration)[-\s]*specific\b.*$/i;
const DERIVED_PATHWAY_DOCUMENT_SUFFIX_PATTERN =
  /\s*(?:\[(?:pdf|docx?|html?)\]|\((?:pdf|docx?|html?)\)|\b(?:pdf|docx?|html)\b)\s*$/i;
const DERIVED_PATHWAY_DOCUMENT_TITLE_SUFFIX_PATTERN =
  /\s+(?:degree\s+program\s+sheet|program\s+sheet|degree\s+sheet|worksheet|check\s*list|checklist)\b.*$/i;
const DERIVED_PATHWAY_REQUIREMENTS_SUFFIX_PATTERN =
  /\b(option|track|route|pathway|certificate|concentration)\b(?:\s*[:\-]\s*|\s+)(?:older\s+|prior\s+|current\s+|academic\s+|course\s+|program\s+|degree\s+|major\s+|graduation\s+)*requirements?\b.*$/i;
const DERIVED_PATHWAY_DATE_SUFFIX_PATTERN =
  /\b(option|track|route|pathway|certificate|concentration)\b(?:\s+(?:autumn|winter|spring|summer|fall)\s+\d{4})+(?:\s*[-\u2013\u2014]\s*(?:autumn|winter|spring|summer|fall)\s+\d{4})?\s*$/i;
const DERIVED_PATHWAY_TRAILING_SITE_SUFFIX_PATTERN =
  /\s+[-\u2013\u2014]\s+(?:UW|University of Washington)\b.*$/i;
const DERIVED_PATHWAY_DEFAULT_KIND_BY_PLAN: Partial<Record<string, "option" | "track" | "route">> = {
  "uw-tacoma-bachelor-of-arts-in-business-administration": "option",
  "uw-tacoma-information-technology": "option",
  "uw-tacoma-sustainable-urban-development": "option",
  "uw-tacoma-urban-studies": "option",
  "uw-tacoma-writing-studies": "track",
};
const SUPPRESS_MATERIALIZED_PATHWAY_PLAN_IDS = new Set([
  "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
]);
const CURATED_DERIVED_PATHWAY_SEEDS_BY_PLAN: Partial<
  Record<string, TransferPlannerDerivedPathwaySeed[]>
> = {
  "uw-tacoma-bachelor-of-arts-in-business-administration": [
    { id: "accounting-option", label: "Accounting option", summary: "" },
    { id: "finance-option", label: "Finance option", summary: "" },
    { id: "general-business-option", label: "General Business option", summary: "" },
    { id: "management-option", label: "Management option", summary: "" },
    { id: "marketing-option", label: "Marketing option", summary: "" },
  ],
  "uw-tacoma-criminal-justice": [
    { id: "campus-pathway", label: "Campus pathway", summary: "" },
    { id: "online-pathway", label: "Online pathway", summary: "" },
  ],
  "uw-tacoma-environmental-science": [
    { id: "general-environmental-science-option", label: "General Environmental Science option", summary: "" },
    { id: "conservation-biology-and-ecology-option", label: "Conservation Biology and Ecology option", summary: "" },
    { id: "geoscience-option", label: "Geoscience option", summary: "" },
  ],
  "uw-tacoma-history": [
    { id: "general-history-option", label: "General History option", summary: "" },
    { id: "arts-culture-and-society-option", label: "Arts, Culture and Society option", summary: "" },
    { id: "global-history-option", label: "Global History option", summary: "" },
    { id: "labor-and-social-movements-option", label: "Labor and Social Movements option", summary: "" },
    { id: "power-gender-and-identity-option", label: "Power, Gender and Identity option", summary: "" },
  ],
  "uw-tacoma-information-technology": [
    {
      id: "information-assurance-cybersecurity-option",
      label: "Information Assurance and Cybersecurity option",
      summary: "",
    },
    {
      id: "digital-mobile-forensics-option",
      label: "Digital Mobile Forensics option",
      summary: "",
    },
  ],
  "uw-tacoma-writing-studies": [
    { id: "creative-writing-track", label: "Creative Writing Track", summary: "" },
    { id: "technical-communication-track", label: "Technical Communication Track", summary: "" },
    { id: "writing-and-social-change-track", label: "Writing and Social Change Track", summary: "" },
  ],
};
const DERIVED_PATHWAY_ALIASES_BY_PLAN: Partial<
  Record<string, Array<{ pattern: RegExp; id: string; label: string }>>
> = {
  "uw-seattle-geography": [
    {
      pattern:
        /^(?:cities,?\s*)?citizenship\s+and\s+migration(?:\s+\(?ccm\)?)?(?:\s+track)?$/i,
      id: "cities-citizenship-and-migration-track",
      label: "Cities, Citizenship, and Migration track",
    },
    {
      pattern:
        /^(?:environment,?\s*)?economy\s+and\s+sustainability(?:\s+\(?ees\)?)?(?:\s+track)?$/i,
      id: "environment-economy-and-sustainability-track",
      label: "Environment, Economy, and Sustainability track",
    },
    {
      pattern:
        /^(?:globalization,?\s*)?health\s+and\s+development(?:\s+\(?ghd\)?)?(?:\s+track)?$/i,
      id: "globalization-health-and-development-track",
      label: "Globalization, Health, and Development track",
    },
    {
      pattern:
        /^(?:gis,?\s*)?mapping\s+and\s+society(?:\s+\(?gms\)?)?(?:\s+track)?$/i,
      id: "gis-mapping-and-society-track",
      label: "GIS, Mapping, and Society track",
    },
    {
      pattern:
        /^(?:b\.?\s*a\.?\s+in\s+geography(?::|\s+with)?\s+)?(?:geography\s+major\s+)?data\s+science(?:\s+option)?$/i,
      id: "geography-major-data-science-option",
      label: "Geography Major Data Science Option",
    },
    {
      pattern:
        /^the\s+requirements\s+for\s+geography\s+majors\s+with\s+the\s+option\s+in\s+data\s+science\s+are\s+as\s+follows:?$/i,
      id: "geography-major-data-science-option",
      label: "Geography Major Data Science Option",
    },
  ],
  "uw-bothell-educational-studies-elementary-education": [
    {
      pattern:
        /^(?:m\.?\s*ed\.?\s+with\s+)?(?:english\s+to\s+speakers\s+of\s+other\s+languages\s*)?\(?esol\)?\s+concentration$/i,
      id: "esol-concentration",
      label: "ESOL Concentration",
    },
  ],
  "uw-seattle-english-creative-writing": [
    {
      pattern: /^creative writing$/i,
      id: "ba-option-family:creative-writing",
      label: "B.A. Creative Writing option",
    },
  ],
  "uw-seattle-german": [
    {
      pattern: /^b\.?\s*a\.?\s+cultural studies option$/i,
      id: "ba-option-family:cultural-studies",
      label: "B.A. Cultural Studies option",
    },
  ],
  "uw-seattle-history-and-philosophy-of-science": [
    {
      pattern: /^ethics$/i,
      id: "ba-option-family:ethics",
      label: "B.A. Ethics option",
    },
  ],
  "uw-seattle-materials-science-engineering": [
    {
      pattern: /^(?:nanoscience and molecular engineering\s*)?\(?nme\)? option$/i,
      id: "nme-option",
      label: "NME Option",
    },
  ],
  "uw-seattle-philosophy": [
    {
      pattern: /^ethics$/i,
      id: "ba-option-family:ethics",
      label: "B.A. Ethics option",
    },
  ],
  "uw-tacoma-environmental-sustainability": [
    {
      pattern:
        /^(?:business(?:\/|\s+and\s+)nonprofit(?:\s+(?:environmental sustainability|leadership))?)(?: option)?$/i,
      id: "business-nonprofit-leadership-option",
      label: "Business and Nonprofit Leadership option",
    },
    {
      pattern: /^(?:(?:pre-)?environmental education|education)(?: option)?$/i,
      id: "education-option",
      label: "Education option",
    },
    {
      pattern: /^(?:environmental communication|communication)(?: option)?$/i,
      id: "environmental-communication-option",
      label: "Environmental Communication option",
    },
    {
      pattern: /^(?:environmental policy and law|policy and law)(?: option)?$/i,
      id: "policy-law-option",
      label: "Policy and Law option",
    },
  ],
  "uw-tacoma-bachelor-of-arts-in-business-administration": [
    {
      pattern: /^(?:baba\s+)?accounting(?:\s+baba)?(?: option)?$/i,
      id: "accounting-option",
      label: "Accounting option",
    },
    {
      pattern: /^(?:baba\s+)?finance(?:\s+baba)?(?: option)?$/i,
      id: "finance-option",
      label: "Finance option",
    },
    {
      pattern: /^(?:baba\s+)?general business(?:\s+baba)?(?: option)?$/i,
      id: "general-business-option",
      label: "General Business option",
    },
    {
      pattern: /^(?:baba\s+)?management(?:\s+baba)?(?: option)?$/i,
      id: "management-option",
      label: "Management option",
    },
    {
      pattern: /^(?:baba\s+)?marketing(?:\s+baba)?(?: option)?$/i,
      id: "marketing-option",
      label: "Marketing option",
    },
  ],
  "uw-tacoma-criminal-justice": [
    {
      pattern: /^(?:campus|on[-\s]?campus|in[-\s]?person)(?:\s+(?:pathway|curriculum|route|option))?$/i,
      id: "campus-pathway",
      label: "Campus pathway",
    },
    {
      pattern: /^online(?:\s+(?:pathway|curriculum|route|option))?$/i,
      id: "online-pathway",
      label: "Online pathway",
    },
  ],
  "uw-tacoma-history": [
    {
      pattern: /^general history option$/i,
      id: "general-history-option",
      label: "General History option",
    },
    {
      pattern: /^culture\s+and\s+society(?: option)?$/i,
      id: "arts-culture-and-society-option",
      label: "Arts, Culture and Society option",
    },
    {
      pattern: /^arts,?\s+culture\s+and\s+society(?: option)?$/i,
      id: "arts-culture-and-society-option",
      label: "Arts, Culture and Society option",
    },
    {
      pattern: /^global history(?: option)?$/i,
      id: "global-history-option",
      label: "Global History option",
    },
    {
      pattern: /^labor\s+and\s+social\s+movements(?: option)?$/i,
      id: "labor-and-social-movements-option",
      label: "Labor and Social Movements option",
    },
    {
      pattern: /^gender\s+and\s+identity(?: option)?$/i,
      id: "power-gender-and-identity-option",
      label: "Power, Gender and Identity option",
    },
    {
      pattern: /^power,?\s+gender\s+and\s+identity(?: option)?$/i,
      id: "power-gender-and-identity-option",
      label: "Power, Gender and Identity option",
    },
  ],
  "uw-tacoma-writing-studies": [
    {
      pattern: /^creative writing(?: track)?$/i,
      id: "creative-writing-track",
      label: "Creative Writing Track",
    },
    {
      pattern: /^to complete a b\.?\s*a\.?\s+in the creative writing track(?: of writing studies)?$/i,
      id: "creative-writing-track",
      label: "Creative Writing Track",
    },
    {
      pattern: /^technical communication(?: track)?$/i,
      id: "technical-communication-track",
      label: "Technical Communication Track",
    },
    {
      pattern:
        /^to complete a b\.?\s*a\.?\s+in the technical communication track(?: of writing studies)?$/i,
      id: "technical-communication-track",
      label: "Technical Communication Track",
    },
    {
      pattern: /^(?:rhetoric,\s*)?writing\s+and\s+social\s+change(?: track)?$/i,
      id: "writing-and-social-change-track",
      label: "Writing and Social Change Track",
    },
  ],
  "uw-tacoma-sustainable-urban-development": [
    {
      pattern: /^(?:community engagement)(?: option)?$/i,
      id: "community-engagement-option",
      label: "Community Engagement option",
    },
    {
      pattern:
        /^(?:geographic information systems(?: \(gis\))?|gis(?: certificate)?)(?:\s+(?:classes|track))?(?: option)?$/i,
      id: "gis-option",
      label: "GIS option",
    },
  ],
  "uw-tacoma-urban-studies": [
    {
      pattern: /^(?:community engagement)(?: option)?$/i,
      id: "community-engagement-option",
      label: "Community Engagement option",
    },
    {
      pattern:
        /^(?:geographic information systems(?: \(gis\))?|gis(?: certificate)?)(?:\s+(?:classes|track))?(?: option)?$/i,
      id: "gis-option",
      label: "GIS option",
    },
  ],
  "uw-tacoma-information-technology": [
    {
      pattern:
        /^(?:information assurance(?:\s+(?:and|&)\s+cybersecurity)?|cybersecurity|iac)(?:\s+option)?$/i,
      id: "information-assurance-cybersecurity-option",
      label: "Information Assurance and Cybersecurity option",
    },
    {
      pattern: /^(?:digital mobile forensics|mobile forensics|dmf)(?:\s+option)?$/i,
      id: "digital-mobile-forensics-option",
      label: "Digital Mobile Forensics option",
    },
  ],
};
const DERIVED_PATHWAY_EXCLUDED_LABEL_PATTERNS_BY_PLAN: Partial<Record<string, RegExp[]>> = {
  "uw-bothell-chemistry-ba": [
    /^b\.?\s*a\.?\s+in chemistry option$/i,
    /^b\.?\s*a\.?\s+route$/i,
    /^biochemistry option$/i,
    /^chemistry series option$/i,
    /^general option$/i,
    /^important planning notes option$/i,
    /^organic chemistry series option$/i,
    /^upper division chemistry electives option$/i,
  ],
  "uw-bothell-chemistry-bs": [
    /^chemistry series option$/i,
    /^organic chemistry series option$/i,
    /^upper division chemistry electives option$/i,
  ],
  "uw-bothell-economics": [
    /^(?:accounting|entrepreneurship|finance|leadership\s*&\s*strategic innovation|lsi|management|marketing|management information systems(?:\s*\(mis\))?|mis|retail management|supply chain management|technology\s*&\s*innovation management(?:\s*\(tim\))?|tim)(?:\s+option(?:\s+and\s+concentration)?|\s+concentration)$/i,
  ],
  "uw-bothell-educational-studies-elementary-education": [/^elementary education option$/i],
  "uw-tacoma-arts-media-culture": [/^B\.?\s*A\.?\s+route$/i],
  "uw-tacoma-bachelor-of-arts-in-business-administration": [/^B\.?\s*A\.?\s+route$/i],
  "uw-tacoma-criminal-justice": [/^B\.?\s*A\.?\s+route$/i],
  "uw-tacoma-environmental-science": [
    /^list [a-z]:?\s+/i,
    /^additional courses for geoscience option$/i,
  ],
  "uw-tacoma-environmental-sustainability": [/^four option$/i],
  "uw-tacoma-history": [
    /^culture\s+and\s+society(?: option)?$/i,
    /^gender\s+and\s+identity(?: option)?$/i,
    /^global studies concentration$/i,
  ],
  "uw-tacoma-urban-studies": [/^gis certificate\b/i],
  "uw-seattle-materials-science-engineering": [
    /^final project and internship\/industrial option$/i,
    /^introduction to molecular and nanoscale principles\b.*\bnot eligible elective for nme option students\b/i,
  ],
  "uw-seattle-jewish-studies": [
    /^(?:south(?:east)? asia|southeast asia|china|japan|korea|general) concentration$/i,
  ],
  "uw-seattle-latin-american-and-caribbean-studies": [
    /^(?:south(?:east)? asia|southeast asia|china|japan|korea|general) concentration$/i,
  ],
  "uw-seattle-speech-and-hearing-sciences": [
    /^(?:adult|pediatric) track$/i,
    /^speech language pathology$/i,
  ],
  "uw-tacoma-writing-studies": [
    /^grassroots activism and community organizing\b/i,
    /^post-graduate studies track$/i,
    /^user experience and usability track$/i,
  ],
};
const PRIMARY_MAJOR_TITLES_BY_PLAN_ID = new Map(
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map((plan) => [plan.id, plan.title] as const)
);
const LINE_DIFFERENT_MAJOR_CACHE = new Map<string, boolean>();
const AUTO_PROMOTED_PRIMARY_OWNER_IDS = new Set(
  (TRANSFER_PLANNER_PRIMARY_PROMOTIONS ?? []).map((entry) => entry.ownerId)
);

type AutoPromotedPathwaySupportEntry = {
  pathwayId: string;
  label: string;
  familyKey: string;
};

type AutoPromotedPathwaySupport = {
  ownerIds: Set<string>;
  pathwayIds: Set<string>;
  familyKeys: Set<string>;
  entriesByPathwayId: Map<string, AutoPromotedPathwaySupportEntry>;
  entriesByIdentityKey: Map<string, AutoPromotedPathwaySupportEntry>;
};

function buildDerivedPathwayIdentityKey(
  planTitle: string | null | undefined,
  value: string | null | undefined
) {
  const semanticValue =
    normalizeTransferPlannerSemanticPathwayLabel(planTitle, value) ||
    normalizeTransferPlannerText(value);

  return semanticValue.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildFallbackPathwayLabel(pathwayId: string) {
  return toDerivedPathwayLabel(normalizeTransferPlannerText(pathwayId).replace(/-/g, " "));
}

const AUTO_PROMOTED_PATHWAY_SUPPORT_BY_PLAN_ID = (() => {
  const supportByPlanId = new Map<string, AutoPromotedPathwaySupport>();

  for (const entry of TRANSFER_PLANNER_PRIMARY_PROMOTIONS ?? []) {
    if (entry.ownerType !== "pathway" || !entry.planId || !entry.pathwayId) {
      continue;
    }

    const pathwayId = normalizeTransferPlannerPathwayId(entry.planId, entry.pathwayId);
    if (!pathwayId) {
      continue;
    }

    const ownerId = buildTransferPlannerOwnerId(entry.planId, pathwayId);
    const planTitle = PRIMARY_MAJOR_TITLES_BY_PLAN_ID.get(entry.planId) ?? entry.ownerTitle ?? "";
    const parsedPathwayLabel =
      normalizeTransferPlannerSemanticPathwayLabel(planTitle, entry.ownerTitle) ||
      buildFallbackPathwayLabel(pathwayId);
    const pathwayLabel =
      pathwayId === entry.pathwayId
        ? parsedPathwayLabel
        : buildFallbackPathwayLabel(pathwayId);
    const familyKey =
      getDerivedPathwaySimilarityKey(pathwayLabel, planTitle) ||
      buildDerivedPathwayIdentityKey(planTitle, pathwayLabel);
    const support =
      supportByPlanId.get(entry.planId) ??
      ({
        ownerIds: new Set<string>(),
        pathwayIds: new Set<string>(),
        familyKeys: new Set<string>(),
        entriesByPathwayId: new Map<string, AutoPromotedPathwaySupportEntry>(),
        entriesByIdentityKey: new Map<string, AutoPromotedPathwaySupportEntry>(),
      } satisfies AutoPromotedPathwaySupport);

    support.ownerIds.add(ownerId);
    support.pathwayIds.add(pathwayId);
    if (familyKey) {
      support.familyKeys.add(familyKey);
    }

    support.entriesByPathwayId.set(pathwayId, {
      pathwayId,
      label: pathwayLabel,
      familyKey,
    });

    for (const candidate of [pathwayId, entry.pathwayId, pathwayLabel, entry.ownerTitle]) {
      const identityKey = buildDerivedPathwayIdentityKey(planTitle, candidate);
      if (!identityKey) {
        continue;
      }

      support.entriesByIdentityKey.set(identityKey, {
        pathwayId,
        label: pathwayLabel,
        familyKey,
      });
    }

    supportByPlanId.set(entry.planId, support);
  }

  return supportByPlanId;
})();

function buildAutoPromotedDerivedPathwaySeeds(plan: TransferPlannerMajorPlan) {
  const support = AUTO_PROMOTED_PATHWAY_SUPPORT_BY_PLAN_ID.get(plan.id);
  if (!support) {
    return [] as TransferPlannerDerivedPathwaySeed[];
  }

  return [...support.entriesByPathwayId.values()].map((entry) => {
    const canonicalPathway = canonicalizeBasePathwayDerivedIdentity(plan.id, {
      id: entry.pathwayId,
      label: entry.label || buildFallbackPathwayLabel(entry.pathwayId),
      summary: "",
    } as TransferPlannerMajorPathway);

    return {
      id: canonicalPathway.id,
      label: normalizeMaterializedTransferPlannerPathwayLabel(canonicalPathway.label),
      summary: "",
    } satisfies TransferPlannerDerivedPathwaySeed;
  });
}

function resolveAutoPromotedPathwaySupportEntry(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const support = AUTO_PROMOTED_PATHWAY_SUPPORT_BY_PLAN_ID.get(plan.id);
  if (!support) {
    return null;
  }

  if (support.pathwayIds.has(pathway.id)) {
    return {
      pathwayId: pathway.id,
      label: pathway.label,
      familyKey:
        getDerivedPathwaySimilarityKey(pathway.label, plan.title) ||
        buildDerivedPathwayIdentityKey(plan.title, pathway.label),
    } satisfies AutoPromotedPathwaySupportEntry;
  }

  for (const candidate of [pathway.id, pathway.label]) {
    const identityKey = buildDerivedPathwayIdentityKey(plan.title, candidate);
    if (!identityKey) {
      continue;
    }

    const canonicalEntry = support.entriesByIdentityKey.get(identityKey);
    if (canonicalEntry) {
      return canonicalEntry;
    }
  }

  return null;
}

function canonicalizeBasePathwayAgainstAutoPromotions(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway
) {
  const canonicalEntry = resolveAutoPromotedPathwaySupportEntry(plan, pathway);
  const autoPromotedPathway =
    !canonicalEntry || canonicalEntry.pathwayId === pathway.id
      ? pathway
      : ({
          ...pathway,
          id: canonicalEntry.pathwayId,
          label: canonicalEntry.label || pathway.label,
        } satisfies TransferPlannerMajorPathway);

  return canonicalizeBasePathwayDerivedIdentity(plan.id, autoPromotedPathway);
}

function canonicalizeBasePathwaysAgainstAutoPromotions(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[]
) {
  const canonicalPathwaysById = new Map<string, TransferPlannerMajorPathway>();
  const canonicalPathwayOrder: string[] = [];

  for (const pathway of basePathways) {
    const canonicalPathway = canonicalizeBasePathwayAgainstAutoPromotions(plan, pathway);
    if (!canonicalPathwaysById.has(canonicalPathway.id)) {
      canonicalPathwayOrder.push(canonicalPathway.id);
      canonicalPathwaysById.set(canonicalPathway.id, canonicalPathway);
      continue;
    }

    const existingPathway = canonicalPathwaysById.get(canonicalPathway.id)!;
    canonicalPathwaysById.set(canonicalPathway.id, {
      ...canonicalPathway,
      summary: canonicalPathway.summary || existingPathway.summary,
      applicationChecklist:
        canonicalPathway.applicationChecklist?.length
          ? canonicalPathway.applicationChecklist
          : existingPathway.applicationChecklist,
      beforeEnrollmentChecklist:
        canonicalPathway.beforeEnrollmentChecklist?.length
          ? canonicalPathway.beforeEnrollmentChecklist
          : existingPathway.beforeEnrollmentChecklist,
      stayAtGrcChecklist:
        canonicalPathway.stayAtGrcChecklist?.length
          ? canonicalPathway.stayAtGrcChecklist
          : existingPathway.stayAtGrcChecklist,
      advisorFlags: canonicalPathway.advisorFlags?.length
        ? canonicalPathway.advisorFlags
        : existingPathway.advisorFlags,
      officialLinks: canonicalPathway.officialLinks?.length
        ? canonicalPathway.officialLinks
        : existingPathway.officialLinks,
      degreeMapSections: canonicalPathway.degreeMapSections?.length
        ? canonicalPathway.degreeMapSections
        : existingPathway.degreeMapSections,
      validationNotes: canonicalPathway.validationNotes?.length
        ? canonicalPathway.validationNotes
        : existingPathway.validationNotes,
      grcCourseList: canonicalPathway.grcCourseList?.length
        ? canonicalPathway.grcCourseList
        : existingPathway.grcCourseList,
      grcCourseListGuidance:
        canonicalPathway.grcCourseListGuidance || existingPathway.grcCourseListGuidance,
      plannerNote: canonicalPathway.plannerNote || existingPathway.plannerNote,
      bestTrackId: canonicalPathway.bestTrackId ?? existingPathway.bestTrackId,
      recommendedTrackSummary:
        canonicalPathway.recommendedTrackSummary || existingPathway.recommendedTrackSummary,
      whyThisTrack: canonicalPathway.whyThisTrack?.length
        ? canonicalPathway.whyThisTrack
        : existingPathway.whyThisTrack,
    });
  }

  return canonicalPathwayOrder.map((pathwayId) => canonicalPathwaysById.get(pathwayId)!);
}

function getPathwayMaterializationSupportKey(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const canonicalEntry = resolveAutoPromotedPathwaySupportEntry(plan, pathway);
  if (canonicalEntry?.pathwayId) {
    return canonicalEntry.pathwayId;
  }

  const labelSimilarityKey = getDerivedPathwaySimilarityKey(pathway.label, plan.title);
  const idSimilarityKey = getDerivedPathwaySimilarityKey(pathway.id, plan.title);
  if (
    labelSimilarityKey &&
    idSimilarityKey &&
    isCompactAcronymPathwaySupportKey(idSimilarityKey, labelSimilarityKey)
  ) {
    return idSimilarityKey;
  }

  return (
    labelSimilarityKey ||
    idSimilarityKey ||
    buildDerivedPathwayIdentityKey(plan.title, pathway.label) ||
    pathway.id.toLowerCase()
  );
}

function isCompactAcronymPathwaySupportKey(idSimilarityKey: string, labelSimilarityKey: string) {
  const idTokens = idSimilarityKey.split("|").filter(Boolean);
  const labelTokens = labelSimilarityKey.split("|").filter(Boolean);
  if (idTokens.length !== 1 || labelTokens.length <= 1) {
    return false;
  }

  return /^[a-z0-9]{2,6}$/.test(idTokens[0]);
}

function isAutoPromotedPathway(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const support = AUTO_PROMOTED_PATHWAY_SUPPORT_BY_PLAN_ID.get(plan.id);
  if (!support) {
    return false;
  }

  const canonicalEntry = resolveAutoPromotedPathwaySupportEntry(plan, pathway);
  return Boolean(
    canonicalEntry &&
      AUTO_PROMOTED_PRIMARY_OWNER_IDS.has(`${plan.id}:pathway:${canonicalEntry.pathwayId}`)
  );
}

function decodeDerivedPathwayHtmlEntities(value: string) {
  return normalizeTransferPlannerText(value);
}

function normalizeDerivedPathwayText(value: string | null | undefined) {
  return decodeDerivedPathwayHtmlEntities(String(value ?? ""));
}

function sourceLineLooksGraduateOnlyForUndergraduatePlan(
  planTitle: string | null | undefined,
  value: string | null | undefined
) {
  const normalizedPlanTitle = normalizeDerivedPathwayText(planTitle);
  if (
    !/\b(?:b\.?\s*a\.?|b\.?\s*s\.?|ba|bs|bachelor\s+of\s+(?:arts|science))\b/i.test(
      normalizedPlanTitle
    )
  ) {
    return false;
  }

  const normalized = normalizeDerivedPathwayText(value);
  return /^(?:m\.?\s*ed\.?|m\.?\s*a\.?|m\.?\s*s\.?|master(?:\s+of)?|doctor(?:\s+of)?|ph\.?\s*d\.?|p\.?\s*h\.?\s*d\.?)\b/i.test(
    normalized
  );
}

function selectDerivedPathwayKindSegment(value: string) {
  const normalized = normalizeDerivedPathwayText(value);
  const segments = normalized
    .split(/\s+(?:[-\u2013\u2014])\s+|\s*:\s+|,\s+/)
    .map((segment) => normalizeDerivedPathwayText(segment))
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (
      DERIVED_PATHWAY_KIND_PATTERN.test(segment) &&
      !/^(?:older|prior|current)\b/i.test(segment) &&
      !/^requirements?\s+for\b/i.test(segment)
    ) {
      return segment;
    }
  }

  return normalized;
}

function stripDerivedPathwayKindSuffix(value: string) {
  return normalizeDerivedPathwayText(value).replace(
    /\s+(option|track|route|pathway|certificate|concentration)\s*$/i,
    ""
  );
}

function normalizeDerivedPathwaySimilarityToken(value: string) {
  const normalized = String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("mathemat")) {
    return "mathemat";
  }

  return normalized
    .replace(/ies$/i, "y")
    .replace(/ical$/i, "")
    .replace(/ics$/i, "")
    .replace(/s$/i, "");
}

function getDerivedPathwaySimilarityKey(
  value: string,
  planTitle: string | null | undefined = null
) {
  const semanticLabel = stripTransferPlannerPlanTitlePrefix(
    planTitle,
    stripDerivedPathwayKindSuffix(
      normalizeDerivedPathwayCandidate(String(planTitle ?? ""), value)
    )
  );

  return Array.from(
    new Set(
      semanticLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .map((token) => normalizeDerivedPathwaySimilarityToken(token))
        .filter((token) => token.length >= 3 && !DERIVED_PATHWAY_SMALL_WORDS.has(token))
    )
  )
    .sort()
    .join("|");
}

export function isSuspiciousStructuralPathwayId(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  if (/^(?:ba|bs)-option-family:[a-z0-9][a-z0-9-]*$/i.test(normalized)) {
    return false;
  }

  return DERIVED_PATHWAY_STRUCTURAL_ID_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isSuspiciousStructuralPathwayLabel(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return false;
  }

  if (/\b(?:pdf|worksheet|check\s*list|checklist)\b/i.test(normalized)) {
    return true;
  }

  if (/^>/.test(normalized) || hasUnmatchedTrailingParenthesis(normalized)) {
    return true;
  }

  if (
    /\b(option|track|route|pathway|certificate|concentration)\b.*\brequirements?\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  return DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isGuidanceOnlyDerivedPathwaySourceLine(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return false;
  }

  return DERIVED_PATHWAY_GUIDANCE_LINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getPlanTitlesForCrossMajorDetection(
  planId: string,
  planTitle: string | null | undefined
) {
  if (PRIMARY_MAJOR_TITLES_BY_PLAN_ID.has(planId)) {
    return PRIMARY_MAJOR_TITLES_BY_PLAN_ID;
  }

  return new Map([...PRIMARY_MAJOR_TITLES_BY_PLAN_ID, [planId, normalizeTransferPlannerText(planTitle)]]);
}

function sourceLineMentionsDifferentMajor(
  planId: string,
  planTitle: string | null | undefined,
  value: string | null | undefined
) {
  const normalizedPlanTitle = normalizeTransferPlannerText(planTitle);
  const normalizedValue = normalizeTransferPlannerText(value);
  const cacheKey = `${planId}\u0000${normalizedPlanTitle}\u0000${normalizedValue}`;
  const cached = LINE_DIFFERENT_MAJOR_CACHE.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  const result = labelMentionsDifferentTransferPlannerMajor(
    planId,
    normalizedValue,
    getPlanTitlesForCrossMajorDetection(planId, planTitle)
  );
  LINE_DIFFERENT_MAJOR_CACHE.set(cacheKey, result);
  return result;
}

function toDerivedPathwayId(value: string) {
  const normalized = normalizeDerivedPathwayText(value);
  if (/^b\.?\s*a\.?\s+route$/i.test(normalized)) {
    return "ba-route";
  }
  if (/^b\.?\s*s\.?\s+route$/i.test(normalized)) {
    return "bs-route";
  }

  return normalized
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDerivedPathwayLabel(value: string) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return normalized;
  }

  if (/^b\s*s\s+to\s+m\s*s\s+pathway$/i.test(normalized)) {
    return "B.S. to M.S. pathway";
  }
  if (/^b\.?\s*a\.?\s+route$/i.test(normalized)) {
    return "B.A. route";
  }
  if (/^b\.?\s*s\.?\s+route$/i.test(normalized)) {
    return "B.S. route";
  }

  const label = normalized.replace(/\b([A-Za-z][A-Za-z']*)\b/g, (match, word, offset) => {
    const upper = word.toUpperCase();
    if (DERIVED_PATHWAY_ACRONYMS.has(upper)) {
      return upper;
    }

    const lower = word.toLowerCase();
    if (offset > 0 && DERIVED_PATHWAY_SMALL_WORDS.has(lower)) {
      return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  if (/\b(?:track|pathway)$/.test(normalized)) {
    const normalizedKindLabel = label.replace(/\bPathway$/, "pathway");
    if (/^Data Science Track$/i.test(normalizedKindLabel)) {
      return "Data Science track";
    }
    if (/\btrack$/.test(normalized)) {
      return normalizedKindLabel.replace(/\bTrack$/, "track");
    }
    return normalizedKindLabel;
  }

  return label;
}

function stripDerivedCredentialSentenceTail(value: string) {
  return normalizeDerivedPathwayText(value)
    .replace(
      /\s+\b(?:is|are|enables?|prepares?|provides?|requires?|offers?|allows?|includes?|leads?|helps?|gives?|focuses?|emphasizes?|designed|intended)\b.*$/i,
      ""
    )
    .replace(/\s+[.;:]\s*$/, "")
    .trim();
}

function getDerivedCredentialDegreePrefix(value: string) {
  const normalized = normalizeDerivedPathwayText(value).toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "bs" || normalized.includes("science")) {
    return "bs" as const;
  }
  if (normalized === "ba" || normalized.includes("arts")) {
    return "ba" as const;
  }
  return null;
}

function getDerivedCredentialDegreeLabel(value: string) {
  const prefix = getDerivedCredentialDegreePrefix(value);
  if (prefix === "bs") {
    return "B.S.";
  }
  if (prefix === "ba") {
    return "B.A.";
  }
  return "";
}

function getDerivedCredentialMajorTokens(value: string) {
  return Array.from(
    new Set(
      normalizeDerivedPathwayText(value)
        .replace(/\([^)]*\)/g, "")
        .replace(/&/g, " and ")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .map((token) => normalizeDerivedPathwaySimilarityToken(token))
        .filter(
          (token) =>
            token.length >= 3 &&
            !DERIVED_PATHWAY_SMALL_WORDS.has(token) &&
            !["bachelor", "degree", "major", "science", "arts"].includes(token)
        )
    )
  );
}

function derivedCredentialMajorMatchesPlan(planTitle: string, credentialMajorTitle: string) {
  const planTokens = getDerivedCredentialMajorTokens(planTitle);
  const credentialTokens = getDerivedCredentialMajorTokens(credentialMajorTitle);
  if (!planTokens.length || !credentialTokens.length) {
    return false;
  }

  const credentialTokenSet = new Set(credentialTokens);
  const matchedTokenCount = planTokens.filter((token) => credentialTokenSet.has(token)).length;
  const requiredTokenCount =
    planTokens.length <= 1 || credentialTokens.length <= 1
      ? 1
      : Math.min(2, planTokens.length, credentialTokens.length);

  return matchedTokenCount >= requiredTokenCount;
}

function stripDerivedCredentialPathwayKind(value: string) {
  return normalizeDerivedPathwayCandidate("", value)
    .replace(/\s+\((?:not\s+admitting|fee[- ]based|online|campus|day|evening)[^)]*\)\s*$/i, "")
    .replace(/\s+(?:option|track|route|pathway|certificate|concentration)\s*$/i, "")
    .trim();
}

function expandDerivedCredentialGeneralSuffix(planTitle: string, value: string) {
  const normalized = normalizeDerivedPathwayText(value);
  const normalizedPlanTitle = normalizeDerivedPathwayCandidate("", planTitle)
    .replace(/\([^)]*\)/g, "")
    .trim();

  if (/^biology$/i.test(normalizedPlanTitle)) {
    if (/^plant$/i.test(normalized)) {
      return "Plant Biology";
    }
    if (/^molecular, cellular, and development$/i.test(normalized)) {
      return "Molecular, Cellular, and Developmental Biology";
    }
  }

  if (!/^general$/i.test(normalized)) {
    return normalized;
  }

  return normalizedPlanTitle ? `General ${normalizedPlanTitle}` : normalized;
}

function buildDerivedCredentialPathwayCandidate(
  planTitle: string,
  credential: string,
  credentialMajorTitle: string,
  suffix: string | null | undefined
) {
  const degreePrefix = getDerivedCredentialDegreePrefix(credential);
  const degreeLabel = getDerivedCredentialDegreeLabel(credential);
  if (!degreePrefix || !degreeLabel) {
    return null;
  }

  if (
    DERIVED_PATHWAY_LABEL_PATTERN.test(credentialMajorTitle) ||
    /\b(?:choose|select|options?|tracks?|routes?|pathways?|concentrations?)\b/i.test(
      credentialMajorTitle
    )
  ) {
    return null;
  }

  if (!derivedCredentialMajorMatchesPlan(planTitle, credentialMajorTitle)) {
    return null;
  }

  if (/\(\s*not\s+admitting\b/i.test(String(suffix ?? ""))) {
    return null;
  }

  const normalizedSuffix = stripDerivedCredentialPathwayKind(String(suffix ?? ""));
  if (!normalizedSuffix) {
    if (degreePrefix !== "ba") {
      return null;
    }

    return {
      id: `${degreePrefix}-route`,
      label: `${degreeLabel} route`,
    };
  }

  const expandedSuffix = expandDerivedCredentialGeneralSuffix(planTitle, normalizedSuffix);
  const labelSuffix = toDerivedPathwayLabel(expandedSuffix);
  const suffixId = toDerivedPathwayId(expandedSuffix);
  if (!labelSuffix || !suffixId) {
    return null;
  }

  return {
    id: `${degreePrefix}-option-family:${suffixId}`,
    label: `${degreeLabel} ${labelSuffix} option`,
  };
}

function extractSingleDerivedCredentialPathwayCandidateFromLine(
  planTitle: string,
  value: string | null | undefined
) {
  const normalized = stripDerivedCredentialSentenceTail(String(value ?? ""));
  const credentialMatch = normalized.match(DERIVED_PATHWAY_UNDERGRAD_MAJOR_CREDENTIAL_PATTERN);
  if (!credentialMatch) {
    return null;
  }

  return buildDerivedCredentialPathwayCandidate(
    planTitle,
    credentialMatch[1],
    credentialMatch[2],
    credentialMatch[3]
  );
}

function extractDerivedCredentialPathwayCandidatesFromLine(
  planTitle: string,
  value: string | null | undefined
) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return [] as Array<{ id: string; label: string }>;
  }

  const fragments = normalized.match(
    /(?:The\s+)?(?:Bachelor of Arts|Bachelor of Science|B\.?\s*A\.?|B\.?\s*S\.?)[^.]{2,220}/gi
  ) ?? [normalized];
  const candidateById = new Map<string, { id: string; label: string }>();

  for (const fragment of fragments) {
    const candidate = extractSingleDerivedCredentialPathwayCandidateFromLine(planTitle, fragment);
    if (candidate) {
      candidateById.set(candidate.id, candidate);
    }
  }

  return [...candidateById.values()];
}

function extractDerivedCredentialPathwayCandidateFromLine(
  planTitle: string,
  value: string | null | undefined
) {
  return extractDerivedCredentialPathwayCandidatesFromLine(planTitle, value)[0] ?? null;
}

function inferDerivedPathwayKind(
  planId: string,
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const explicitKind = DERIVED_PATHWAY_DEFAULT_KIND_BY_PLAN[planId];
  if (explicitKind) {
    return explicitKind;
  }

  const allLines = parsedSourceBlocks.flatMap((block) => [
    ...(block.chooseStatements ?? []),
    ...(block.pathwayLabels ?? []),
  ]);

  for (const line of allLines) {
    const normalized = normalizeDerivedPathwayText(line).toLowerCase();
    if (!normalized) {
      continue;
    }

    if (/\bformal options?\b|\boptions?\b/.test(normalized)) {
      return "option";
    }
    if (/\btracks?\b/.test(normalized)) {
      return "track";
    }
    if (/\broutes?\b/.test(normalized)) {
      return "route";
    }
  }

  return null;
}

function normalizeDerivedPathwayCandidate(planTitle: string, value: string) {
  const normalized = normalizeTransferPlannerSemanticPathwayLabel(
    planTitle,
    selectDerivedPathwayKindSegment(normalizeDerivedPathwayText(value))
      .replace(/^[>\s]+/, "")
      .replace(/^(?:and|or)\s+/i, "")
      .replace(/^[A-Z]\.\s+/i, "")
      .replace(/^\d+\)\s+/i, "")
      .replace(/^option\s+\d+\s*:\s*/i, "")
      .replace(
        /^(?:(?:The\s+)?(?:Bachelor|Master|Doctor|Minor|Associate|B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)[^()]{0,120})\((.{2,100}\b(?:track|option|route|pathway|certificate|concentration))\)\s*$/i,
        "$1"
      )
      .replace(/^(?:B\.?\s*A\.?|B\.?\s*S\.?) [^:]{1,80}:\s*/i, "")
      .replace(
        /^(?:\d{1,3}(?:-\d{1,3})?\s+credits?\s+for\s+(?:the\s+)?)([\s\S]+)$/i,
        "$1"
      )
      .replace(
        /^(.+?)\s+\(([A-Z0-9]{2,8})\)\s+(option|track|route|pathway|certificate|concentration)$/i,
        "$2 $3"
      )
      .replace(
        /^(.+?)\s+\(([A-Z0-9]{2,8})\)\s+(option|track|route|pathway|certificate|concentration)\s+program$/i,
        "$2 $3"
      )
      .replace(DERIVED_PATHWAY_WITH_OPTION_IN_PATTERN, "$1 Option")
      .replace(
        /\s+for\s+(?:[A-Z]{2,8}(?:\s+[A-Z]{1,8})?|[A-Z][A-Za-z&.\s]{1,80})\s+majors?$/i,
        ""
      )
      .replace(DERIVED_PATHWAY_TRAILING_SITE_SUFFIX_PATTERN, "")
      .replace(DERIVED_PATHWAY_DOCUMENT_TITLE_SUFFIX_PATTERN, "")
      .replace(DERIVED_PATHWAY_DOCUMENT_SUFFIX_PATTERN, "")
      .replace(DERIVED_PATHWAY_REQUIREMENTS_SUFFIX_PATTERN, "$1")
      .replace(DERIVED_PATHWAY_DATE_SUFFIX_PATTERN, "$1")
      .replace(/^(?:declaring(?: the)?|how to declare(?: the)?|program requirements?)\s+/i, "")
      .replace(/^requirements?\s+for\s+(?:the\s+)?/i, "")
      .replace(/\b(option|track|route|pathway|certificate|concentration)\b\s+[-–—]\s+.*$/i, "$1")
      .replace(/\s+[-–]\s+UW\b.*$/i, "")
      .replace(/\b(option|track|route|pathway|certificate|concentration)\b\s+[-\u2013\u2014]\s+.*$/i, "$1")
      .replace(
        /\s+\(\d+(?:-\d+)?\s+credits?\)\s*:\s*choose from the following:?$/i,
        ""
      )
      .replace(/\s+\((?:\d+(?:-\d+)?\s+credits?)\)\s*$/i, "")
      .replace(/\s+-\s+please see website\.?$/i, "")
      .replace(/\s+\|\s+.*$/, "")
      .replace(/\s+[.;:]\s*$/, "")
  );

  return stripUnmatchedTrailingParenthesis(normalized);
}

function extractDerivedPathwaySemanticPrefix(
  value: string,
  defaultKind: "option" | "track" | "route" | null
) {
  const structuralPrefixMatch = normalizeDerivedPathwayText(value).match(
    DERIVED_PATHWAY_STRUCTURAL_PREFIX_PATTERN
  );
  if (!structuralPrefixMatch) {
    return null;
  }

  const [, prefix, explicitKind] = structuralPrefixMatch;
  const normalizedPrefix = normalizeDerivedPathwayCandidate("", prefix);
  if (
    !normalizedPrefix ||
    DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalizedPrefix))
  ) {
    return null;
  }

  return `${normalizedPrefix} ${explicitKind ?? defaultKind ?? "option"}`;
}

function applyDerivedPathwayAlias(planId: string, value: string) {
  const aliases = DERIVED_PATHWAY_ALIASES_BY_PLAN[planId] ?? [];
  for (const alias of aliases) {
    if (alias.pattern.test(value)) {
      return {
        id: alias.id,
        label: alias.label,
      };
    }
  }

  return null;
}

function isPlanExcludedDerivedPathwayCandidate(planId: string, value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return false;
  }

  if (
    planId.startsWith("uw-tacoma-") &&
    planId !== "uw-tacoma-global-studies" &&
    /^global studies concentration$/i.test(normalized)
  ) {
    return true;
  }

  return (DERIVED_PATHWAY_EXCLUDED_LABEL_PATTERNS_BY_PLAN[planId] ?? []).some((pattern) =>
    pattern.test(normalized)
  );
}

function isPlanExcludedDerivedPathway(
  planId: string,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  return (
    isPlanExcludedDerivedPathwayCandidate(planId, pathway.label) ||
    isPlanExcludedDerivedPathwayCandidate(
      planId,
      normalizeTransferPlannerText(pathway.id).replace(/-/g, " ")
    )
  );
}

function isBachelorsRouteCandidate(value: string | null | undefined, credential: "a" | "s") {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return false;
  }

  return new RegExp(`^b\\.?\\s*${credential}\\.?\\s+route$`, "i").test(normalized);
}

function getExplicitBachelorRouteCredential(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  if (/\b(?:Bachelor of Arts|B\.?\s*A\.?|BA)\b/i.test(normalized)) {
    return "a" as const;
  }
  if (/\b(?:Bachelor of Science|B\.?\s*S\.?|BS)\b/i.test(normalized)) {
    return "s" as const;
  }
  return null;
}

function isMismatchedBachelorCredentialPathway(
  planTitle: string | null | undefined,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const planCredential = getExplicitBachelorRouteCredential(planTitle);
  if (!planCredential) {
    return false;
  }

  const pathwayLabel = normalizeDerivedPathwayText(pathway.label);
  const pathwayIdText = normalizeTransferPlannerText(pathway.id).replace(/-/g, " ");
  const isBaRoute =
    isBachelorsRouteCandidate(pathwayLabel, "a") ||
    isBachelorsRouteCandidate(pathwayIdText, "a") ||
    /\b(?:b\.?\s*a\.?|bachelor\s+of\s+arts)\b.*\b(?:option|track|route|pathway|concentration)\b/i.test(
      `${pathwayLabel} ${pathwayIdText}`
    );
  const isBsRoute =
    isBachelorsRouteCandidate(pathwayLabel, "s") ||
    isBachelorsRouteCandidate(pathwayIdText, "s") ||
    /\b(?:b\.?\s*s\.?|bachelor\s+of\s+science)\b.*\b(?:option|track|route|pathway|concentration)\b/i.test(
      `${pathwayLabel} ${pathwayIdText}`
    );

  return (planCredential === "a" && isBsRoute) || (planCredential === "s" && isBaRoute);
}

function canonicalizeBasePathwayDerivedIdentity(
  planId: string,
  pathway: TransferPlannerMajorPathway
) {
  const normalizedPathwayId = normalizeTransferPlannerPathwayId(planId, pathway.id);
  const pathwayWithCanonicalId =
    normalizedPathwayId && normalizedPathwayId !== pathway.id
      ? ({
          ...pathway,
          id: normalizedPathwayId,
        } satisfies TransferPlannerMajorPathway)
      : pathway;
  const labelText = normalizeDerivedPathwayText(pathwayWithCanonicalId.label);
  const idText = normalizeTransferPlannerText(pathwayWithCanonicalId.id).replace(/-/g, " ");
  const aliased = applyDerivedPathwayAlias(planId, labelText) ?? applyDerivedPathwayAlias(planId, idText);
  const basePathway = aliased
    ? ({
        ...pathwayWithCanonicalId,
        id: aliased.id,
        label: aliased.label,
      } satisfies TransferPlannerMajorPathway)
    : ({
        ...pathwayWithCanonicalId,
        label: normalizeMaterializedTransferPlannerPathwayLabel(pathwayWithCanonicalId.label),
      } satisfies TransferPlannerMajorPathway);

  const canonicalLabelText = normalizeDerivedPathwayText(basePathway.label);
  const canonicalIdText = normalizeTransferPlannerText(basePathway.id).replace(/-/g, " ");
  if (
    isBachelorsRouteCandidate(canonicalLabelText, "a") ||
    isBachelorsRouteCandidate(canonicalIdText, "a")
  ) {
    return {
      ...basePathway,
      id: "ba-route",
      label: "B.A. route",
    } satisfies TransferPlannerMajorPathway;
  }

  if (
    isBachelorsRouteCandidate(canonicalLabelText, "s") ||
    isBachelorsRouteCandidate(canonicalIdText, "s")
  ) {
    return {
      ...basePathway,
      id: "bs-route",
      label: "B.S. route",
    } satisfies TransferPlannerMajorPathway;
  }

  return basePathway;
}

function stripUnmatchedTrailingParenthesis(value: string) {
  if (!hasUnmatchedTrailingParenthesis(value)) {
    return value;
  }

  return value.replace(/\)+\s*$/, "").trim();
}

function hasUnmatchedTrailingParenthesis(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized.endsWith(")")) {
    return false;
  }

  const openCount = normalized.match(/\(/g)?.length ?? 0;
  const closeCount = normalized.match(/\)/g)?.length ?? 0;
  return closeCount > openCount;
}

function hasUnrecognizedAllCapsPathwayToken(value: string | null | undefined) {
  const tokens = normalizeDerivedPathwayText(value).match(/\b[A-Z][A-Z0-9]{2,}\b/g) ?? [];
  return tokens.some((token) => !DERIVED_PATHWAY_ACRONYMS.has(token));
}

function shouldKeepDerivedCleanerPathwayLabel(
  basePathway: Pick<TransferPlannerMajorPathway, "label">,
  derivedPathway: Pick<TransferPlannerDerivedPathwaySeed, "label">
) {
  if (
    normalizeDerivedPathwayText(basePathway.label).toLowerCase() !==
    normalizeDerivedPathwayText(derivedPathway.label).toLowerCase()
  ) {
    return false;
  }

  if (hasUnrecognizedAllCapsPathwayToken(basePathway.label)) {
    return true;
  }

  return [...DERIVED_PATHWAY_ACRONYMS].some((acronym) => {
    const acronymPattern = new RegExp(`\\b${acronym}\\b`);
    return acronymPattern.test(derivedPathway.label) && !acronymPattern.test(basePathway.label);
  });
}

export function normalizeMaterializedTransferPlannerPathwayLabel(
  value: string | null | undefined
) {
  const normalized = normalizeTransferPlannerText(value)
    .replace(/^[>\s]+/, "")
    .replace(/\bIac\b/g, "IAC")
    .replace(/\boption\s+and\s+concentration\b/gi, "Option and Concentration");
  if (/^b\s*s\s+to\s+m\s*s\s+pathway$/i.test(normalized)) {
    return "B.S. to M.S. pathway";
  }
  if (hasUnrecognizedAllCapsPathwayToken(normalized)) {
    return toDerivedPathwayLabel(normalized);
  }
  return normalized;
}

function canonicalizeDerivedPathwayCandidate(
  planId: string,
  planTitle: string,
  value: string | null | undefined,
  defaultKind: "option" | "track" | "route" | null,
  options: {
    allowBareLabel?: boolean;
  } = {}
) {
  if (sourceLineLooksGraduateOnlyForUndergraduatePlan(planTitle, value)) {
    return null;
  }

  let normalized = normalizeDerivedPathwayCandidate(planTitle, String(value ?? ""));
  if (!normalized) {
    return null;
  }

  const semanticStructuralPrefix = extractDerivedPathwaySemanticPrefix(normalized, defaultKind);
  if (semanticStructuralPrefix) {
    normalized = semanticStructuralPrefix;
  }

  if (DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return null;
  }

  if (isPlanExcludedDerivedPathwayCandidate(planId, normalized)) {
    return null;
  }

  if (isSuspiciousStructuralPathwayId(normalized)) {
    return null;
  }

  if (DERIVED_PATHWAY_EXPLICIT_COURSE_CODE_PATTERN.test(normalized)) {
    return null;
  }

  if (
    normalized.length > 80 ||
    !/[A-Za-z]/.test(normalized) ||
    normalized.split(/\s+/).filter(Boolean).length > 10
  ) {
    return null;
  }

  const aliased = applyDerivedPathwayAlias(planId, normalized);
  if (aliased) {
    return aliased;
  }

  if (!DERIVED_PATHWAY_LABEL_PATTERN.test(normalized)) {
    if (options.allowBareLabel) {
      const bareLabel = toDerivedPathwayLabel(normalized);
      const bareId = toDerivedPathwayId(bareLabel);
      if (!bareId || isSuspiciousStructuralPathwayId(bareId)) {
        return null;
      }

      return {
        id: bareId,
        label: bareLabel,
      };
    }

    if (!defaultKind) {
      return null;
    }

    normalized = `${normalized} ${defaultKind}`;
  }

  const label = toDerivedPathwayLabel(normalized);
  const id = toDerivedPathwayId(label);
  if (!id) {
    return null;
  }

  return {
    id,
    label,
  };
}

function extractDerivedPathwayCandidateFromLine(
  planId: string,
  planTitle: string,
  value: string | null | undefined,
  defaultKind: "option" | "track" | "route" | null
) {
  let normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return null;
  }

  if (/^\[?\s*supplemental official source\]?\b/i.test(normalized)) {
    return null;
  }

  const aliasedLine = applyDerivedPathwayAlias(planId, normalized);
  if (aliasedLine) {
    return aliasedLine;
  }

  if (sourceLineLooksGraduateOnlyForUndergraduatePlan(planTitle, normalized)) {
    return null;
  }

  if (/^(?:Doctor|Master)\s+Of\b|^(?:Doctor|Master)\b/i.test(normalized)) {
    return null;
  }

  const credentialPathwayCandidate = extractDerivedCredentialPathwayCandidateFromLine(
    planTitle,
    normalized
  );
  if (credentialPathwayCandidate) {
    return credentialPathwayCandidate;
  }

  const inlineLabelMatch = normalized.match(
    /^([^:]{1,100}\b(?:track|option|route|pathway|certificate|concentration)\b(?:\s*\([^)]{1,40}\))?)\s*:/i
  );
  if (inlineLabelMatch) {
    const candidate = canonicalizeDerivedPathwayCandidate(
      planId,
      planTitle,
      inlineLabelMatch[1],
      defaultKind
    );
    if (candidate) {
      return candidate;
    }
  }

  const shouldCheckForForeignMajor =
    /(?:\s[-\u2013\u2014:]\s|\|)/.test(normalized) ||
    /\bmajor\b/i.test(normalized) ||
    (normalized.length <= 160 && DERIVED_PATHWAY_LABEL_PATTERN.test(normalized));
  if (
    shouldCheckForForeignMajor &&
    sourceLineMentionsDifferentMajor(planId, planTitle, normalized)
  ) {
    return null;
  }

  if (isGuidanceOnlyDerivedPathwaySourceLine(normalized)) {
    return null;
  }

  if (normalized.includes("|")) {
    normalized = normalizeDerivedPathwayText(normalized.split("|")[0]);
  }

  const enumeratedLabelMatch = normalized.match(/^[A-Z]\.\s+(.{2,80})$/);
  if (enumeratedLabelMatch) {
    return canonicalizeDerivedPathwayCandidate(
      planId,
      planTitle,
      enumeratedLabelMatch[1],
      defaultKind
    );
  }

  const degreeTitleMatch = normalized.match(DERIVED_PATHWAY_DEGREE_TITLE_PATTERN);
  if (degreeTitleMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, degreeTitleMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const degreeParenthesesMatch = normalized.match(DERIVED_PATHWAY_DEGREE_PARENTHESES_PATTERN);
  if (degreeParenthesesMatch) {
    return canonicalizeDerivedPathwayCandidate(
      planId,
      planTitle,
      degreeParenthesesMatch[1],
      defaultKind,
      {
        allowBareLabel: true,
      }
    );
  }

  const withOptionInMatch = normalized.match(DERIVED_PATHWAY_WITH_OPTION_IN_PATTERN);
  if (withOptionInMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, withOptionInMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const pathwayTitleMatch = normalized.match(/^(?:B\.?\s*A\.?|B\.?\s*S\.?) [^:]{1,80}:\s+(.{2,80})$/i);
  if (pathwayTitleMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, pathwayTitleMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const listLabelMatch = normalized.match(DERIVED_PATHWAY_LIST_LABEL_PATTERN);
  if (listLabelMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, listLabelMatch[1], defaultKind);
  }

  const applyDirectlyMatch = normalized.match(DERIVED_PATHWAY_APPLY_DIRECTLY_PATTERN);
  if (applyDirectlyMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, applyDirectlyMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const credentialMatch = normalized.match(DERIVED_PATHWAY_CREDENTIAL_PATTERN);
  if (credentialMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, credentialMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const pursuingTrackMatch = normalized.match(/\bstudents pursuing the\s+(.{2,60}?)\s+track\b/i);
  if (pursuingTrackMatch) {
    return canonicalizeDerivedPathwayCandidate(
      planId,
      planTitle,
      `${pursuingTrackMatch[1]} track`,
      defaultKind,
      { allowBareLabel: true }
    );
  }

  if (!DERIVED_PATHWAY_LABEL_PATTERN.test(normalized)) {
    return null;
  }

  return canonicalizeDerivedPathwayCandidate(planId, planTitle, normalized, defaultKind);
}

function splitDerivedPathwayChoiceValues(value: string) {
  const normalized = normalizeDerivedPathwayText(value).replace(/\s+\.\s*$/, "");
  if (!normalized || !/(?:\s+or\s+|\s*,\s*)/i.test(normalized)) {
    return [];
  }

  return normalized
    .replace(/\s*,\s+(?:and\/or|and|or)\s+/gi, "|")
    .replace(/\s+(?:or|and\/or)\s+/gi, "|")
    .split(/\s*\|\s*|\s*,\s*/i)
    .map((entry) => normalizeDerivedPathwayText(entry))
    .filter(Boolean);
}

function getDerivedPathwayChoiceCount(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  const match = normalized.match(
    /\b(?:(\d+)|(two|three|four|five|six|seven|eight|nine|ten))\s+(?:formal\s+)?(?:concentrations?|tracks?|options?|routes?|pathways?)\b/i
  );
  if (!match) {
    return null;
  }

  const numericCount = match[1] ? Number(match[1]) : null;
  const wordCount = PATHWAY_CHOICE_COUNT_BY_WORD.get(String(match[2] ?? "").toLowerCase()) ?? null;
  const count = numericCount ?? wordCount;
  return count != null && Number.isFinite(count) && count >= 2 && count <= 10 ? count : null;
}

function getDerivedPathwayChoiceKind(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  const match = normalized.match(
    /\b(concentration|track|option|route|pathway)s?\b/i
  );

  return (match?.[1]?.toLowerCase() ?? null) as
    | "option"
    | "track"
    | "route"
    | null;
}

function lineLooksLikeDerivedPathwayChoiceStatement(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  return (
    /\b(?:concentrations?|tracks?|options?|routes?|pathways?)\b[^:]{0,40}:/i.test(normalized) ||
    /\bchoice of [^.]{0,80}?(?:options?|tracks?|routes?|pathways?)\s+(?:in|between)\b/i.test(normalized) ||
    /\bchoose\s+[^:]{2,120}\s*:/i.test(normalized)
  );
}

function splitDerivedPathwayChoiceListValues(
  value: string,
  expectedCount: number | null = null
) {
  const normalized = normalizeDerivedPathwayText(value).replace(/\s+\.\s*$/, "");
  if (!normalized) {
    return [];
  }

  if (normalized.includes(";")) {
    const parts = normalized
      .split(/\s*;\s*/g)
      .map((entry) => normalizeDerivedPathwayText(entry))
      .filter(Boolean);

    if (expectedCount && parts.length < expectedCount) {
      for (let index = 0; index < parts.length && parts.length < expectedCount; index += 1) {
        const commaIndex = parts[index].indexOf(",");
        if (commaIndex <= 0) {
          continue;
        }

        const left = normalizeDerivedPathwayText(parts[index].slice(0, commaIndex));
        const right = normalizeDerivedPathwayText(parts[index].slice(commaIndex + 1));
        if (!left || !right) {
          continue;
        }

        parts.splice(index, 1, left, right);
      }
    }

    return parts;
  }

  return splitDerivedPathwayChoiceValues(normalized);
}

function extractDerivedPathwayCandidatesFromChoiceStatement(
  planId: string,
  planTitle: string,
  value: string | null | undefined,
  defaultKind: "option" | "track" | "route" | null
) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized || !lineLooksLikeDerivedPathwayChoiceStatement(normalized)) {
    return [] as Array<{ id: string; label: string }>;
  }

  const expectedCount = getDerivedPathwayChoiceCount(normalized);
  const effectiveDefaultKind = defaultKind ?? getDerivedPathwayChoiceKind(normalized);
  const tails = [
    normalized.match(/\b(?:options?|tracks?|routes?|pathways?)\b[^:]{0,40}:\s*([^.\n]+?)(?:\.\s*|$)/i)?.[1],
    normalized.match(
      /\bchoice of [^.]{0,80}?(?:options?|tracks?|routes?|pathways?)\s+(?:in|between)\s+(.+?)(?:\.\s*|$)/i
    )?.[1],
    normalized.match(/\bchoose\s+([^:]{2,120})\s*:/i)?.[1],
  ].filter(Boolean) as string[];

  const results: Array<{ id: string; label: string }> = [];
  for (const tail of tails) {
    for (const candidate of splitDerivedPathwayChoiceListValues(tail, expectedCount)) {
      const resolved = canonicalizeDerivedPathwayCandidate(
        planId,
        planTitle,
        candidate,
        effectiveDefaultKind
      );
      if (resolved) {
        results.push(resolved);
      }
    }
  }

  return results;
}

function mergeCuratedDerivedPathwaySeeds(
  plan: TransferPlannerMajorPlan,
  parsedSeeds: TransferPlannerDerivedPathwaySeed[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const curatedSeeds = CURATED_DERIVED_PATHWAY_SEEDS_BY_PLAN[plan.id] ?? [];
  if (!curatedSeeds.length || !parsedSourceBlocks.length) {
    return parsedSeeds;
  }

  const seedById = new Map<string, TransferPlannerDerivedPathwaySeed>();
  for (const seed of [...curatedSeeds, ...parsedSeeds]) {
    if (
      isSuspiciousStructuralPathwayId(seed.id) ||
      isSuspiciousStructuralPathwayLabel(seed.label) ||
      isPlanExcludedDerivedPathway(plan.id, seed)
    ) {
      continue;
    }

    if (!seedById.has(seed.id)) {
      seedById.set(seed.id, seed);
    }
  }

  return [...seedById.values()];
}

function buildDerivedPathwaySeeds(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const stableParsedSourceBlocks = parsedSourceBlocks.filter((block) => {
    if (block.resolutionStrategy !== "alternate-official-source") {
      return true;
    }

    // Alternate-official fallbacks from overview primaries can be valuable for
    // lower-division evidence, but they are too noisy to mint new pathway rows.
    return block.primaryParserType !== "html-overview-page";
  });
  const planLevelBlocks = stableParsedSourceBlocks.filter((block) => !block.pathwayId);

  function buildSeedsFromBlocks(sourceBlocks: TransferPlannerParsedRequirementSourceBlock[]) {
    const defaultKind = inferDerivedPathwayKind(plan.id, sourceBlocks);
    const sourceChoiceLines = sourceBlocks.flatMap((block) => [
      ...(block.chooseStatements ?? []),
      ...(block.requirementCueLines ?? []).filter(
        (line) =>
          getDerivedPathwayChoiceCount(line) != null ||
          lineLooksLikeDerivedPathwayChoiceStatement(line)
      ),
    ]);
    const choiceStatements = [...new Set(sourceChoiceLines)];
    const rawSourceLines = sourceBlocks.flatMap((block) => [
      block.ownerTitle,
      ...(block.requirementCueLines ?? []),
      ...(block.chooseStatements ?? []),
    ]);
    const credentialSupportedPathwayFamilies = new Set(
      sourceBlocks
        .flatMap((block) => block.pathwayLabels ?? [])
        .map((line) => extractDerivedCredentialPathwayCandidateFromLine(plan.title, line))
        .map((candidate) =>
          candidate ? getDerivedPathwaySimilarityKey(candidate.label, plan.title) : ""
        )
        .filter(Boolean)
    );
    const shouldLimitChoiceSeedsToCredentialFamilies =
      credentialSupportedPathwayFamilies.size >= 2;
    const supportedRawCandidateFamilies = new Set<string>();

    for (const statement of choiceStatements) {
      for (const candidate of extractDerivedPathwayCandidatesFromChoiceStatement(
        plan.id,
        plan.title,
        statement,
        defaultKind
      )) {
        const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
        if (similarityKey) {
          supportedRawCandidateFamilies.add(similarityKey);
        }
      }
    }

    for (const line of rawSourceLines) {
      for (const candidate of extractDerivedPathwayCandidatesFromChoiceStatement(
        plan.id,
        plan.title,
        line,
        defaultKind
      )) {
        const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
        if (similarityKey) {
          supportedRawCandidateFamilies.add(similarityKey);
        }
      }

      const candidate = extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind);
      const similarityKey = candidate
        ? getDerivedPathwaySimilarityKey(candidate.label, plan.title)
        : "";
      if (similarityKey) {
        supportedRawCandidateFamilies.add(similarityKey);
      }
    }

    const hasForeignMajorPathwayEvidence = rawSourceLines.some(
      (line) =>
        sourceLineMentionsDifferentMajor(plan.id, plan.title, line) &&
        /(?:\s[-\u2013\u2014:]\s|\|)/.test(normalizeDerivedPathwayText(line)) &&
        DERIVED_PATHWAY_LABEL_PATTERN.test(normalizeDerivedPathwayText(line))
    );
    const credentialPathwayLabelLines = sourceBlocks.flatMap((block) =>
      (block.pathwayLabels ?? []).filter(
        (line) => extractDerivedCredentialPathwayCandidatesFromLine(plan.title, line).length > 0
      )
    );
    const supportedPathwayLabelLines = sourceBlocks.flatMap((block) =>
      (block.pathwayLabels ?? []).filter((line) => {
        const candidate = extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind);
        if (!candidate) {
          return false;
        }

        const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
        if (!similarityKey) {
          return false;
        }

        if (!hasForeignMajorPathwayEvidence) {
          return true;
        }

        if (!supportedRawCandidateFamilies.size) {
          return !hasForeignMajorPathwayEvidence;
        }

        return supportedRawCandidateFamilies.has(similarityKey);
      })
    );
    const orderedSourceLines = [
      ...new Set([...credentialPathwayLabelLines, ...supportedPathwayLabelLines, ...rawSourceLines]),
    ];
    const seedById = new Map<string, TransferPlannerDerivedPathwaySeed>();
    const seedIdsByNormalizedBase = new Map<string, string>();
    const seedIdsBySimilarityKey = new Map<string, string>();

    function pushSeed(
      candidate: { id: string; label: string } | null,
      options: { preserveOrder?: boolean } = {}
    ) {
      if (
        !candidate ||
        isSuspiciousStructuralPathwayId(candidate.id) ||
        isPlanExcludedDerivedPathway(plan.id, candidate)
      ) {
        return;
      }

      const normalizedBaseLabel = stripDerivedPathwayKindSuffix(candidate.label).toLowerCase();
      const existingIdForBase = normalizedBaseLabel
        ? seedIdsByNormalizedBase.get(normalizedBaseLabel) ?? null
        : null;
      const existingSeedForBase = existingIdForBase ? seedById.get(existingIdForBase) ?? null : null;
      if (
        existingSeedForBase &&
        candidate.label.length >= existingSeedForBase.label.length &&
        !options.preserveOrder
      ) {
        return;
      }

      const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
      const existingIdForSimilarity = similarityKey
        ? seedIdsBySimilarityKey.get(similarityKey) ?? null
        : null;
      const existingSeedForSimilarity = existingIdForSimilarity
        ? seedById.get(existingIdForSimilarity) ?? null
        : null;
      const candidateIsCredentialScoped = isCredentialScopedDerivedPathway(candidate);
      if (
        existingSeedForSimilarity &&
        !options.preserveOrder &&
        !(candidateIsCredentialScoped && isCredentialScopedDerivedPathway(existingSeedForSimilarity))
      ) {
        return;
      }

      const existingSeed = seedById.get(candidate.id) ?? null;
      if (
        existingSeed &&
        existingSeed.label.length <= candidate.label.length &&
        !options.preserveOrder
      ) {
        return;
      }

      const nextSeed = {
        id: candidate.id,
        label: candidate.label,
        summary: "",
      } satisfies TransferPlannerDerivedPathwaySeed;

      seedById.set(candidate.id, nextSeed);
      if (normalizedBaseLabel) {
        seedIdsByNormalizedBase.set(normalizedBaseLabel, candidate.id);
      }
      if (similarityKey) {
        seedIdsBySimilarityKey.set(similarityKey, candidate.id);
      }
    }

    for (const statement of choiceStatements) {
      for (const candidate of extractDerivedPathwayCandidatesFromChoiceStatement(
        plan.id,
        plan.title,
        statement,
        defaultKind
      )) {
        if (shouldLimitChoiceSeedsToCredentialFamilies) {
          continue;
        }

        pushSeed(candidate);
      }
    }

    for (const line of orderedSourceLines) {
      const choiceCandidates = extractDerivedPathwayCandidatesFromChoiceStatement(
        plan.id,
        plan.title,
        line,
        defaultKind
      );
      if (choiceCandidates.length) {
        choiceCandidates.forEach((candidate) => pushSeed(candidate));
        continue;
      }

      const credentialCandidates = extractDerivedCredentialPathwayCandidatesFromLine(
        plan.title,
        line
      );
      if (credentialCandidates.length) {
        credentialCandidates.forEach((candidate) => pushSeed(candidate));
        continue;
      }

      pushSeed(extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind));
    }

    const seeds = [...seedById.values()].filter(
      (seed) =>
        !isSuspiciousStructuralPathwayLabel(seed.label) &&
        !isPlanExcludedDerivedPathway(plan.id, seed) &&
        !isMismatchedBachelorCredentialPathway(plan.title, seed)
    );
    const namedOptionOrTrackSeedCount = seeds.filter(
      (seed) =>
        !/^(?:ba|bs)-route$/i.test(seed.id) &&
        !isCredentialScopedDerivedPathway(seed) &&
        /\b(?:option|track|concentration|pathway|route)\b/i.test(seed.label)
    ).length;
    const pathwaySeeds = namedOptionOrTrackSeedCount >= 2
      ? seeds.filter((seed) => !/^(?:ba|bs)-route$/i.test(seed.id))
      : seeds;
    const blockHasNestedHonorsContext = sourceBlocks.some((block) =>
      [...(block.requirementCueLines ?? []), ...(block.chooseStatements ?? [])].some((line) =>
        /\bdepartmental honors?\b|\bhonors program\b/i.test(normalizeDerivedPathwayText(line))
      )
    );

    if (!blockHasNestedHonorsContext) {
      return pathwaySeeds;
    }

    const baseSupportKeys = new Set(
      basePathways.map((pathway) => getPathwayMaterializationSupportKey(plan, pathway)).filter(Boolean)
    );
    const trackSeedCount = pathwaySeeds.filter((seed) => /\btrack\b/i.test(seed.label)).length;
    if (trackSeedCount < 2) {
      return pathwaySeeds;
    }

    return pathwaySeeds.filter((seed) => {
      if (!/\boption\b/i.test(seed.label) || /\bhonors\b/i.test(seed.label)) {
        return true;
      }

      if (isAutoPromotedPathway(plan, seed)) {
        return true;
      }

      return baseSupportKeys.has(getPathwayMaterializationSupportKey(plan, seed));
    });
  }

  function buildSeedsFromDedicatedPathwayBlocks() {
    const seedById = new Map<string, TransferPlannerDerivedPathwaySeed>();

    for (const block of stableParsedSourceBlocks) {
      const pathwayId = normalizeTransferPlannerText(block.pathwayId);
      if (
        !pathwayId ||
        block.sourceRoleStatus !== "primary" ||
        block.canCreateSchedulableRows === false ||
        isSuspiciousStructuralPathwayId(pathwayId)
      ) {
        continue;
      }

      const hasSchedulableEvidence = Boolean(
        block.parsedUwCourseCodes?.length ||
          block.parsedRequirementGroups?.length ||
          block.parsedRequirementCourses?.length ||
          block.requirementCueLines?.length ||
          block.chooseStatements?.length ||
          block.pathwayLabels?.length
      );
      if (!hasSchedulableEvidence) {
        continue;
      }

      const defaultKind = inferDerivedPathwayKind(plan.id, [block]);
      const candidateLines = [
        block.ownerTitle,
        block.sourceLabel,
        block.primarySourceLabel,
        ...(block.pathwayLabels ?? []),
      ];
      const candidate =
        candidateLines
          .map((line) => extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind))
          .find(Boolean) ??
        (!pathwayId.includes(":")
          ? canonicalizeDerivedPathwayCandidate(
              plan.id,
              plan.title,
              buildFallbackPathwayLabel(pathwayId),
              defaultKind,
              { allowBareLabel: true }
            )
          : null);
      if (
        !candidate ||
        isSuspiciousStructuralPathwayLabel(candidate.label) ||
        isPlanExcludedDerivedPathway(plan.id, candidate) ||
        isMismatchedBachelorCredentialPathway(plan.title, candidate)
      ) {
        continue;
      }

      if (!seedById.has(pathwayId)) {
        seedById.set(pathwayId, {
          id: pathwayId,
          label: candidate.label,
          summary: "",
        });
      }
    }

    return [...seedById.values()];
  }

  const parsedSeedsById = new Map<string, TransferPlannerDerivedPathwaySeed>();
  for (const seed of [
    ...buildSeedsFromBlocks(planLevelBlocks.length ? planLevelBlocks : stableParsedSourceBlocks),
    ...buildSeedsFromDedicatedPathwayBlocks(),
  ]) {
    if (!parsedSeedsById.has(seed.id)) {
      parsedSeedsById.set(seed.id, seed);
    }
  }

  return mergeCuratedDerivedPathwaySeeds(
    plan,
    [...parsedSeedsById.values()],
    stableParsedSourceBlocks
  );
}

function buildPathwayEvidenceFamiliesForBlock(
  plan: TransferPlannerMajorPlan,
  block: TransferPlannerParsedRequirementSourceBlock
) {
  const defaultKind = inferDerivedPathwayKind(plan.id, [block]);
  const families = new Set<string>();
  const sourceLines = [
    block.ownerTitle,
    ...(block.pathwayLabels ?? []),
    ...(block.requirementCueLines ?? []),
    ...(block.chooseStatements ?? []),
  ];

  for (const statement of block.chooseStatements ?? []) {
    for (const candidate of extractDerivedPathwayCandidatesFromChoiceStatement(
      plan.id,
      plan.title,
      statement,
      defaultKind
    )) {
      const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
      if (similarityKey) {
        families.add(similarityKey);
      }
    }
  }

  for (const line of sourceLines) {
    const candidate = extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind);
    const similarityKey = candidate
      ? getDerivedPathwaySimilarityKey(candidate.label, plan.title)
      : "";
    if (similarityKey) {
      families.add(similarityKey);
    }
  }

  return families;
}

function buildPathwayContentEvidenceFamiliesForBlock(
  plan: TransferPlannerMajorPlan,
  block: TransferPlannerParsedRequirementSourceBlock
) {
  const defaultKind = inferDerivedPathwayKind(plan.id, [block]);
  const families = new Set<string>();
  const sourceLines = [
    ...(block.pathwayLabels ?? []),
    ...(block.requirementCueLines ?? []),
    ...(block.chooseStatements ?? []),
  ];

  for (const statement of block.chooseStatements ?? []) {
    for (const candidate of extractDerivedPathwayCandidatesFromChoiceStatement(
      plan.id,
      plan.title,
      statement,
      defaultKind
    )) {
      const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
      if (similarityKey) {
        families.add(similarityKey);
      }
    }
  }

  for (const line of sourceLines) {
    const candidate = extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind);
    const similarityKey = candidate
      ? getDerivedPathwaySimilarityKey(candidate.label, plan.title)
      : "";
    if (similarityKey) {
      families.add(similarityKey);
    }
  }

  return families;
}

function sourceLineContainsPathwayFamily(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">,
  line: string | null | undefined
) {
  const pathwayFamily = getPathwayMaterializationSupportKey(plan, pathway);
  if (!pathwayFamily) {
    return false;
  }

  const familyTokens = pathwayFamily.split("|").filter((token) => token.length >= 3);
  if (familyTokens.length < 2) {
    return false;
  }

  const lineTokens = new Set(
    normalizeDerivedPathwayText(line)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .map((token) => normalizeDerivedPathwaySimilarityToken(token))
      .filter((token) => token.length >= 3 && !DERIVED_PATHWAY_SMALL_WORDS.has(token))
  );

  const matchedTokenCount = familyTokens.filter((token) => lineTokens.has(token)).length;
  const requiredTokenCount =
    familyTokens.length <= 2 ? familyTokens.length : Math.max(2, familyTokens.length - 1);

  return matchedTokenCount >= requiredTokenCount;
}

function sourceLineSupportsPathwayFamily(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">,
  line: string | null | undefined
) {
  if (!sourceLineContainsPathwayFamily(plan, pathway, line)) {
    return false;
  }

  const pathwayCredentialScope = getPathwayCredentialScope(pathway);
  const lineCredentialScope = getPathwayCredentialScope({ id: "", label: line ?? "" });
  return !pathwayCredentialScope || !lineCredentialScope || pathwayCredentialScope === lineCredentialScope;
}

function filterUnsupportedBasePathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[]
) {
  const planLevelBlocks = parsedSourceBlocks.filter((block) => !block.pathwayId);
  if (!planLevelBlocks.length) {
    return basePathways;
  }
  const planLevelLines = planLevelBlocks.flatMap((block) => [
    ...(block.pathwayLabels ?? []),
    ...(block.requirementCueLines ?? []),
    ...(block.chooseStatements ?? []),
  ]);
  const allSourcePathwayLines = parsedSourceBlocks.flatMap((block) => [
    ...(block.pathwayLabels ?? []),
    ...(block.chooseStatements ?? []),
  ]);
  const nonHonorsDerivedPathwayCount = derivedPathways.filter(
    (pathway) => !/\bhonou?rs?\s+thesis\b/i.test(normalizeDerivedPathwayText(pathway.label))
  ).length;
  const hasPlanLevelChoicePathwayEvidence =
    nonHonorsDerivedPathwayCount >= 2 &&
    planLevelLines.some((line) =>
      /\b(?:choose|select)\s+one\s+of\b.*\b(?:concentrations?|tracks?|options?|routes?|pathways?)\b/i.test(
        normalizeDerivedPathwayText(line)
      )
    );
  const hasPlanLevelForeignMajorPathwayEvidence = planLevelLines.some(
    (line) =>
      sourceLineMentionsDifferentMajor(plan.id, plan.title, line) &&
      /(?:\s[-\u2013\u2014:]\s|\|)/.test(normalizeDerivedPathwayText(line)) &&
      DERIVED_PATHWAY_LABEL_PATTERN.test(normalizeDerivedPathwayText(line))
  );

  const derivedFamilies = new Set(
    derivedPathways
      .map((pathway) => getPathwayMaterializationSupportKey(plan, pathway))
      .filter(Boolean)
  );
  const hasPlanLevelDerivedFamilies = derivedFamilies.size > 0;

  return basePathways.filter((pathway) => {
    const ownerId = `${plan.id}:pathway:${pathway.id}`;
    if (AUTO_PROMOTED_PRIMARY_OWNER_IDS.has(ownerId)) {
      return true;
    }

    if (
      hasPlanLevelChoicePathwayEvidence &&
      /\bhonou?rs?\s+thesis\b/i.test(
        normalizeDerivedPathwayText(`${pathway.id} ${pathway.label}`)
      )
    ) {
      return false;
    }

    const pathwayFamily = getPathwayMaterializationSupportKey(plan, pathway);
    if (!pathwayFamily || derivedFamilies.has(pathwayFamily)) {
      return true;
    }
    const pathwayBlocks = parsedSourceBlocks.filter((block) => block.pathwayId === pathway.id);
    if (!pathwayBlocks.length) {
      return (
        !isSuspiciousStructuralPathwayId(pathway.id) &&
        !isSuspiciousStructuralPathwayLabel(pathway.label) &&
        [...planLevelLines, ...allSourcePathwayLines].some((line) =>
          sourceLineContainsPathwayFamily(plan, pathway, line)
        )
      );
    }

    const hasSupportingPathwayBlock = pathwayBlocks.some((block) =>
      buildPathwayEvidenceFamiliesForBlock(plan, block).has(pathwayFamily)
    );
    const hasDedicatedParsedPathwayBlock = hasDedicatedSourceBackedPathwayBlock(
      plan,
      pathway,
      parsedSourceBlocks
    );
    if (!hasSupportingPathwayBlock && !hasDedicatedParsedPathwayBlock) {
      return false;
    }

    const planLevelSourceUrls = new Set(
      planLevelBlocks
        .map((block) => normalizeTransferPlannerText(block.sourceUrl))
        .filter(Boolean)
    );
    const hasDedicatedPathwaySource = pathwayBlocks.some((block) => {
      const normalizedSourceUrl = normalizeTransferPlannerText(block.sourceUrl);
      return normalizedSourceUrl && !planLevelSourceUrls.has(normalizedSourceUrl);
    });
    if (
      !hasDedicatedPathwaySource &&
      (isSuspiciousStructuralPathwayId(pathway.id) ||
        isSuspiciousStructuralPathwayLabel(pathway.label))
    ) {
      return false;
    }

    const hasDedicatedPathwayContentEvidence = pathwayBlocks.some((block) => {
      const contentFamilies = buildPathwayContentEvidenceFamiliesForBlock(plan, block);
      return (
        contentFamilies.has(pathwayFamily) ||
        [
          ...(block.pathwayLabels ?? []),
          ...(block.requirementCueLines ?? []),
          ...(block.chooseStatements ?? []),
        ].some((line) => sourceLineSupportsPathwayFamily(plan, pathway, line))
      );
    });

    return hasDedicatedPathwaySource || hasDedicatedPathwayContentEvidence;
  });
}

export function deriveTransferPlannerPathwaySeeds(
  plan: TransferPlannerMajorPlan,
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  return buildDerivedPathwaySeeds(plan, plan.pathways ?? [], parsedSourceBlocks);
}

function shouldPreferDerivedPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[]
) {
  if (!basePathways.length) {
    return derivedPathways.length >= 2;
  }

  if (!derivedPathways.length) {
    return false;
  }

  const suspiciousBasePathways = basePathways.filter(
    (pathway) =>
      isSuspiciousStructuralPathwayId(pathway.id) || isSuspiciousStructuralPathwayLabel(pathway.label)
  );
  const semanticBasePathways = basePathways.filter(
    (pathway) =>
      !isSuspiciousStructuralPathwayId(pathway.id) && !isSuspiciousStructuralPathwayLabel(pathway.label)
  );
  const semanticDerivedPathways = derivedPathways.filter(
    (pathway) =>
      !isSuspiciousStructuralPathwayId(pathway.id) &&
      !isSuspiciousStructuralPathwayLabel(pathway.label)
  );
  const semanticBaseFamilies = semanticBasePathways
    .map((pathway) => getPathwayMaterializationSupportKey(plan, pathway))
    .filter(Boolean);
  const semanticBaseFamilySet = new Set(semanticBaseFamilies);
  const semanticBaseFamilyCount = new Set(semanticBaseFamilies).size;
  const semanticDerivedFamilySet = new Set(
    semanticDerivedPathways
      .map((pathway) => getPathwayMaterializationSupportKey(plan, pathway))
      .filter(Boolean)
  );
  const hasDuplicateSemanticBaseFamilies = semanticBaseFamilyCount < semanticBaseFamilies.length;
  const hasHtmlEntityLeak = basePathways.some((pathway) => hasTransferPlannerHtmlEntityLeak(pathway.label));
  const hasAutoPromotedDerivedExpansion = semanticDerivedPathways.some((pathway) => {
    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    return supportKey && !semanticBaseFamilySet.has(supportKey) && isAutoPromotedPathway(plan, pathway);
  });
  const hasSemanticDerivedExpansion = semanticDerivedPathways.some((pathway) => {
    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    return supportKey && !semanticBaseFamilySet.has(supportKey);
  });
  const hasSupportedDerivedExpansion =
    semanticBasePathways.length <= 2 &&
    semanticDerivedPathways.length > semanticBaseFamilyCount &&
    semanticBaseFamilies.length > 0 &&
    semanticBaseFamilies.every((family) => semanticDerivedFamilySet.has(family));
  const hasAcronymCanonicalDerivedPathway = semanticDerivedPathways.some((derivedPathway) =>
    semanticBasePathways.some((basePathway) =>
      shouldKeepDerivedAcronymPathway(basePathway, derivedPathway)
    )
  );
  const hasCleanerCanonicalDerivedPathway = semanticDerivedPathways.some((derivedPathway) =>
    semanticBasePathways.some(
      (basePathway) =>
        getPathwayMaterializationSupportKey(plan, basePathway) ===
          getPathwayMaterializationSupportKey(plan, derivedPathway) &&
        shouldKeepDerivedCleanerPathwayLabel(basePathway, derivedPathway)
    )
  );
  const shouldCollapseToSingleSemanticDerivedPathway =
    semanticDerivedPathways.length === 1 &&
    basePathways.length > 1 &&
    semanticBasePathways.length > 0 &&
    semanticBaseFamilies.length > 0 &&
    semanticBaseFamilies.every((family) => {
      const derivedFamily = getPathwayMaterializationSupportKey(plan, semanticDerivedPathways[0]);
      return family === derivedFamily;
    }) &&
    (suspiciousBasePathways.length > 0 || hasDuplicateSemanticBaseFamilies || hasHtmlEntityLeak);

  if (hasAcronymCanonicalDerivedPathway) {
    return true;
  }

  if (hasCleanerCanonicalDerivedPathway) {
    return true;
  }

  if (suspiciousBasePathways.length === basePathways.length) {
    return true;
  }

  if (semanticDerivedPathways.length < 2) {
    return hasSemanticDerivedExpansion || shouldCollapseToSingleSemanticDerivedPathway;
  }

  if (hasAutoPromotedDerivedExpansion) {
    return true;
  }

  if (hasSupportedDerivedExpansion) {
    return true;
  }

  if (hasDuplicateSemanticBaseFamilies || hasHtmlEntityLeak) {
    return true;
  }

  if (!suspiciousBasePathways.length) {
    return false;
  }

  if (semanticBaseFamilyCount > 0 && semanticDerivedPathways.length >= semanticBaseFamilyCount) {
    return true;
  }

  return semanticDerivedPathways.length >= basePathways.length - suspiciousBasePathways.length;
}

function filterDerivedPathwaysToKnownBaseFamilies(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[]
) {
  const semanticBasePathways = basePathways.filter(
    (pathway) =>
      !isSuspiciousStructuralPathwayId(pathway.id) &&
      !isSuspiciousStructuralPathwayLabel(pathway.label)
  );
  const baseFamilies = new Set(
    semanticBasePathways
      .filter(
        (pathway) =>
          !isSuspiciousStructuralPathwayId(pathway.id) &&
          !isSuspiciousStructuralPathwayLabel(pathway.label)
      )
      .map((pathway) => getPathwayMaterializationSupportKey(plan, pathway))
      .filter(Boolean)
  );

  if (!baseFamilies.size) {
    return derivedPathways;
  }

  const matchingDerivedPathways = derivedPathways.filter((pathway) =>
    baseFamilies.has(getPathwayMaterializationSupportKey(plan, pathway)) ||
    isAutoPromotedPathway(plan, pathway)
  );

  if (!matchingDerivedPathways.length) {
    return derivedPathways;
  }

  const titleSpecializationMatch = normalizeDerivedPathwayText(plan.title).match(
    /:\s*([^()]+?)(?:\s*\([^)]*\))?\s*$/
  );
  const titleSpecializationFamily = titleSpecializationMatch
    ? getDerivedPathwaySimilarityKey(titleSpecializationMatch[1], plan.title)
    : "";
  const hasTitleScopedKnownBase =
    Boolean(titleSpecializationFamily) &&
    semanticBasePathways.some(
      (pathway) => getPathwayMaterializationSupportKey(plan, pathway) === titleSpecializationFamily
    );

  if (
    semanticBasePathways.length <= 2 &&
    derivedPathways.length > matchingDerivedPathways.length &&
    !hasTitleScopedKnownBase
  ) {
    return derivedPathways;
  }

  return matchingDerivedPathways;
}

function shouldKeepDerivedAcronymPathway(
  basePathway: Pick<TransferPlannerMajorPathway, "label">,
  derivedPathway: Pick<TransferPlannerDerivedPathwaySeed, "label">
) {
  const acronymMatch = normalizeDerivedPathwayText(basePathway.label).match(
    /\(([A-Z0-9]{2,8})\)\s+(option|track|route|pathway|certificate|concentration)\b/i
  );
  if (!acronymMatch) {
    return false;
  }

  if (/^concentration$/i.test(acronymMatch[2])) {
    return false;
  }

  const expectedLabel = normalizeDerivedPathwayText(`${acronymMatch[1]} ${acronymMatch[2]}`);
  return normalizeDerivedPathwayText(derivedPathway.label).toLowerCase() === expectedLabel.toLowerCase();
}

function isCredentialScopedDerivedPathway(pathway: Pick<TransferPlannerDerivedPathwaySeed, "id">) {
  return /^(?:ba|bs)-(?:route|option-family(?::|$))/i.test(pathway.id);
}

function getPathwayCredentialScope(
  pathway: Pick<TransferPlannerMajorPathway | TransferPlannerDerivedPathwaySeed, "id" | "label">
) {
  const idText = normalizeTransferPlannerText(pathway.id).toLowerCase();
  const labelText = normalizeDerivedPathwayText(pathway.label).toLowerCase();
  const combinedText = `${idText} ${labelText}`;

  if (/\bb\.?\s*s\.?\b|\bbachelor\s+of\s+science\b|\bbs[-:\s]/i.test(combinedText)) {
    return "bs";
  }

  if (/\bb\.?\s*a\.?\b|\bbachelor\s+of\s+arts\b|\bba[-:\s]/i.test(combinedText)) {
    return "ba";
  }

  return null;
}

function canonicalizeDerivedPathwaysAgainstSupportedBase(
  plan: TransferPlannerMajorPlan,
  supportedBasePathways: TransferPlannerMajorPathway[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[]
) {
  if (!supportedBasePathways.length || !derivedPathways.length) {
    return derivedPathways;
  }

  const basePathwaysByFamily = new Map<string, TransferPlannerMajorPathway[]>();
  for (const pathway of supportedBasePathways) {
    if (
      isSuspiciousStructuralPathwayId(pathway.id) ||
      isSuspiciousStructuralPathwayLabel(pathway.label)
    ) {
      continue;
    }

    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    if (!supportKey) {
      continue;
    }

    basePathwaysByFamily.set(supportKey, [
      ...(basePathwaysByFamily.get(supportKey) ?? []),
      pathway,
    ]);
  }

  const canonicalPathwaysById = new Map<string, TransferPlannerDerivedPathwaySeed>();
  const canonicalOrder: string[] = [];
  const pushCanonicalPathway = (pathway: TransferPlannerDerivedPathwaySeed) => {
    if (!canonicalPathwaysById.has(pathway.id)) {
      canonicalOrder.push(pathway.id);
      canonicalPathwaysById.set(pathway.id, pathway);
      return;
    }

    const existingPathway = canonicalPathwaysById.get(pathway.id)!;
    canonicalPathwaysById.set(pathway.id, {
      ...existingPathway,
      label: existingPathway.label || pathway.label,
      summary: existingPathway.summary || pathway.summary,
    });
  };

  for (const pathway of derivedPathways) {
    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    const matchingBasePathways = supportKey ? basePathwaysByFamily.get(supportKey) ?? [] : [];
    if (
      matchingBasePathways.length !== 1 ||
      isAutoPromotedPathway(plan, pathway) ||
      isCredentialScopedDerivedPathway(pathway)
    ) {
      pushCanonicalPathway(pathway);
      continue;
    }

    const basePathway = matchingBasePathways[0];
    if (shouldKeepDerivedAcronymPathway(basePathway, pathway)) {
      pushCanonicalPathway(pathway);
      continue;
    }

    if (shouldKeepDerivedCleanerPathwayLabel(basePathway, pathway)) {
      pushCanonicalPathway({
        ...pathway,
        id: basePathway.id,
        summary: pathway.summary || basePathway.summary || "",
      });
      continue;
    }

    pushCanonicalPathway({
      ...pathway,
      id: basePathway.id,
      label: normalizeMaterializedTransferPlannerPathwayLabel(basePathway.label) || pathway.label,
      summary: pathway.summary || basePathway.summary || "",
    });
  }

  return canonicalOrder.map((pathwayId) => canonicalPathwaysById.get(pathwayId)!);
}

function hasDedicatedSourceBackedPathwayBlock(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">,
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const ownerId = `${plan.id}:pathway:${pathway.id}`;
  if (AUTO_PROMOTED_PRIMARY_OWNER_IDS.has(ownerId)) {
    return true;
  }

  if (
    parsedSourceBlocks.some(
      (block) =>
        block.pathwayId === pathway.id &&
        Boolean(
          block.parsedUwCourseCodes?.length ||
            block.requirementCueLines?.length ||
            block.chooseStatements?.length ||
            block.pathwayLabels?.length
        )
    )
  ) {
    return true;
  }

  return parsedSourceBlocks.some(
    (block) =>
      (block.pathwayLabels ?? []).some((line) =>
        sourceLineSupportsPathwayFamily(plan, pathway, line)
      )
  );
}

function mergeDerivedAndSourceBackedBasePathways(
  plan: TransferPlannerMajorPlan,
  supportedBasePathways: TransferPlannerMajorPathway[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const materializedPathwaysById = new Map<string, TransferPlannerMajorPathway>();
  const materializedOrder: string[] = [];
  const representedFamilyCredentialScopes = new Map<string, Set<string | null>>();
  const pushMaterializedPathway = (pathway: TransferPlannerMajorPathway) => {
    if (!materializedPathwaysById.has(pathway.id)) {
      materializedOrder.push(pathway.id);
    }

    materializedPathwaysById.set(pathway.id, pathway);
    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    if (supportKey) {
      const credentialScopes = representedFamilyCredentialScopes.get(supportKey) ?? new Set<string | null>();
      credentialScopes.add(getPathwayCredentialScope(pathway));
      representedFamilyCredentialScopes.set(supportKey, credentialScopes);
    }
  };

  for (const pathway of derivedPathways) {
    const sourceBackedBasePathway = supportedBasePathways.find(
      (basePathway) => basePathway.id === pathway.id
    );
    pushMaterializedPathway({
      id: pathway.id,
      label: normalizeMaterializedTransferPlannerPathwayLabel(pathway.label),
      summary: pathway.summary,
      officialLinks:
        pathway.officialLinks ??
        sourceBackedBasePathway?.officialLinks ??
        getDerivedPathwayOfficialLinks(plan, {
          id: pathway.id,
          label: pathway.label,
        }),
    });
  }

  for (const pathway of supportedBasePathways) {
    if (
      isSuspiciousStructuralPathwayId(pathway.id) ||
      isSuspiciousStructuralPathwayLabel(pathway.label) ||
      isPlanExcludedDerivedPathway(plan.id, pathway) ||
      materializedPathwaysById.has(pathway.id) ||
      !hasDedicatedSourceBackedPathwayBlock(plan, pathway, parsedSourceBlocks)
    ) {
      continue;
    }

    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    if (supportKey) {
      const representedCredentialScopes = representedFamilyCredentialScopes.get(supportKey) ?? null;
      const credentialScope = getPathwayCredentialScope(pathway);
      if (
        representedCredentialScopes &&
        (representedCredentialScopes.has(credentialScope) ||
          !credentialScope ||
          representedCredentialScopes.has(null))
      ) {
        continue;
      }
    }

    pushMaterializedPathway({
      ...pathway,
      label: normalizeMaterializedTransferPlannerPathwayLabel(pathway.label),
    });
  }

  return materializedOrder.map((pathwayId) => materializedPathwaysById.get(pathwayId)!);
}

export function materializeTransferPlannerPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
): TransferPlannerMajorPathway[] {
  if (SUPPRESS_MATERIALIZED_PATHWAY_PLAN_IDS.has(plan.id)) {
    return [];
  }

  const keepMaterializedPathway = (pathway: TransferPlannerMajorPathway) =>
    !isPlanExcludedDerivedPathway(plan.id, pathway) &&
    !isMismatchedBachelorCredentialPathway(plan.title, pathway) &&
    !isSuspiciousStructuralPathwayId(pathway.id) &&
    !isSuspiciousStructuralPathwayLabel(pathway.label);
  const canonicalBasePathways = canonicalizeBasePathwaysAgainstAutoPromotions(plan, basePathways).filter(
    keepMaterializedPathway
  );
  const rawDerivedPathways = filterDerivedPathwaysToKnownBaseFamilies(
    plan,
    canonicalBasePathways,
    [
      ...buildAutoPromotedDerivedPathwaySeeds(plan),
      ...buildDerivedPathwaySeeds(plan, canonicalBasePathways, parsedSourceBlocks),
    ]
  );
  const preliminaryDerivedPathways = canonicalizeDerivedPathwaysAgainstSupportedBase(
    plan,
    canonicalBasePathways,
    rawDerivedPathways
  );
  const supportedBasePathways = filterUnsupportedBasePathways(
    plan,
    canonicalBasePathways,
    parsedSourceBlocks,
    preliminaryDerivedPathways
  );
  const derivedPathways = canonicalizeDerivedPathwaysAgainstSupportedBase(
    plan,
    supportedBasePathways,
    preliminaryDerivedPathways
  );
  if (
    supportedBasePathways.length &&
    !shouldPreferDerivedPathways(plan, supportedBasePathways, derivedPathways)
  ) {
    if (
      !derivedPathways.length &&
      supportedBasePathways.every(
        (pathway) =>
          isSuspiciousStructuralPathwayId(pathway.id) ||
          isSuspiciousStructuralPathwayLabel(pathway.label)
      )
    ) {
      return [];
    }

    return supportedBasePathways
      .filter(keepMaterializedPathway)
      .map((pathway) => ({
        ...pathway,
        label: normalizeMaterializedTransferPlannerPathwayLabel(pathway.label),
      }));
  }

  if (derivedPathways.length) {
    return mergeDerivedAndSourceBackedBasePathways(
      plan,
      supportedBasePathways,
      derivedPathways,
      parsedSourceBlocks
    ).filter(keepMaterializedPathway);
  }

  return supportedBasePathways.filter(keepMaterializedPathway);
}

export function countMaterializedTransferPlannerPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
): number {
  return materializeTransferPlannerPathways(plan, basePathways, parsedSourceBlocks).length;
}
