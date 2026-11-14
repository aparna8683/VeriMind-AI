/**
 * Source Quality Assessment Service
 * 
 * Classifies retrieved web sources using domain heuristics, URL structure, and contextual indicators.
 * Transparently explains the reason for categorization and emphasizes that
 * retrieval relevance is distinct from factual credibility.
 */

const CATEGORIES = {
    OFFICIAL_DOCS: {
        id: "official_documentation",
        label: "Official Documentation / Standards",
        description: "Official developer documentation, technical standards, product manuals, or specifications."
    },
    GOVERNMENT_INSTITUTIONAL: {
        id: "government_institutional",
        label: "Government / Institutional",
        description: "Government agencies, international bodies, regulatory authorities, or public health institutions."
    },
    ACADEMIC_RESEARCH: {
        id: "academic_research",
        label: "Academic / Peer-Reviewed Research",
        description: "Academic institutions, preprints, scientific journals, or research repositories."
    },
    INDEPENDENT_JOURNALISM: {
        id: "independent_journalism",
        label: "Independent News / Journalism",
        description: "Established independent news wire services, investigative journalism, or major press outlets."
    },
    INDUSTRY_PUBLICATION: {
        id: "industry_publication",
        label: "Industry Publication / Analysis",
        description: "Technology news, industry analysis, market research, or specialized trade journalism."
    },
    COMPANY_VENDOR_BLOG: {
        id: "company_vendor_blog",
        label: "Company / Commercial Blog",
        description: "Vendor-published articles, company press releases, marketing collateral, or sponsored content."
    },
    OTHER_UNKNOWN: {
        id: "other_unknown",
        label: "General Web / Unclassified",
        description: "General web pages, forum discussions, personal blogs, or unclassified domains."
    }
};

/**
 * Known domain rules & heuristics
 */
const GOV_DOMAINS = [
    ".gov", ".mil", ".europa.eu", "who.int", "un.org", "cdc.gov", "fda.gov",
    "nih.gov", "nasa.gov", "whitehouse.gov", "justice.gov", "ftc.gov",
    "ec.europa.eu", "oecd.org", "worldbank.org", "imf.org", "wipo.int", "wto.org"
];

const ACADEMIC_DOMAINS = [
    ".edu", ".ac.uk", "arxiv.org", "nature.com", "sciencedirect.com",
    "springer.com", "cell.com", "ieee.org", "acm.org", "biorxiv.org",
    "medrxiv.org", "pnas.org", "thelancet.com", "nejm.org", "plos.org",
    "frontiersin.org", "mdpi.com", "jstor.org", "wiley.com", "semanticscholar.org",
    "scholar.google.com", "pubmed.ncbi.nlm.nih.gov"
];

const JOURNALISM_DOMAINS = [
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com",
    "washingtonpost.com", "theguardian.com", "wsj.com", "bloomberg.com",
    "ft.com", "afp.com", "aljazeera.com", "npr.org", "dw.com", "pbs.org",
    "economist.com", "time.com", "cnbc.com", "france24.com"
];

const INDUSTRY_DOMAINS = [
    "techcrunch.com", "wired.com", "arstechnica.com", "theverge.com",
    "venturebeat.com", "engadget.com", "zdnet.com", "anandtech.com",
    "tomshardware.com", "infoq.com", "theregister.com", "technologyreview.com",
    "cio.com", "infoworld.com"
];

const DOCS_PATTERNS = [
    "docs.", "documentation.", "developer.", "dev.", "api.", "spec.", "standards.",
    "w3.org", "ietf.org", "iso.org", "github.com", "gitlab.com"
];

function extractDomain(url) {
    if (!url || typeof url !== "string") return "";
    try {
        const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
        return parsed.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return "";
    }
}

/**
 * Assesses the quality profile and category of a retrieved source.
 */
export function assessSourceQuality(source) {
    const url = source?.url || "";
    const title = source?.title || "";
    const content = source?.content || "";
    const domain = extractDomain(url);
    const score = typeof source?.score === "number" ? source.score : null;

    let category = CATEGORIES.OTHER_UNKNOWN;
    let reason = "Domain does not match known institutional, academic, or news categories.";
    let isPrimarySourceLikely = false;

    if (!domain) {
        return {
            sourceId: source.id,
            domain: "unknown",
            category: category.id,
            categoryLabel: category.label,
            categoryDescription: category.description,
            reason: "URL could not be parsed.",
            isPrimarySourceLikely: false,
            retrievalScore: score,
            relevanceDisclaimer: "Search relevance reflects query keyword overlap and does not measure factual veracity."
        };
    }

    // Check Government / Institutional
    if (GOV_DOMAINS.some((pattern) => domain.endsWith(pattern) || domain.includes(pattern))) {
        category = CATEGORIES.GOVERNMENT_INSTITUTIONAL;
        reason = `Identified as a government or international institutional domain (${domain}). Frequently serves as primary regulatory or official statistical source.`;
        isPrimarySourceLikely = true;
    }
    // Check Academic / Research
    else if (ACADEMIC_DOMAINS.some((pattern) => domain.endsWith(pattern) || domain.includes(pattern))) {
        category = CATEGORIES.ACADEMIC_RESEARCH;
        reason = `Identified as an academic institution or peer-reviewed scientific publisher (${domain}).`;
        isPrimarySourceLikely = true;
    }
    // Check Official Documentation
    else if (
        DOCS_PATTERNS.some((pattern) => domain.includes(pattern) || url.toLowerCase().includes("/docs") || url.toLowerCase().includes("/documentation"))
    ) {
        category = CATEGORIES.OFFICIAL_DOCS;
        reason = `URL pattern indicates technical documentation, specification, or code repository (${domain}).`;
        isPrimarySourceLikely = true;
    }
    // Check Independent Journalism
    else if (JOURNALISM_DOMAINS.some((pattern) => domain === pattern || domain.endsWith(`.${pattern}`))) {
        category = CATEGORIES.INDEPENDENT_JOURNALISM;
        reason = `Identified as an established independent news or investigative journalism outlet (${domain}).`;
        isPrimarySourceLikely = false;
    }
    // Check Industry Publications
    else if (INDUSTRY_DOMAINS.some((pattern) => domain === pattern || domain.endsWith(`.${pattern}`))) {
        category = CATEGORIES.INDUSTRY_PUBLICATION;
        reason = `Identified as a specialized technology or industry trade publication (${domain}).`;
        isPrimarySourceLikely = false;
    }
    // Check Blog or Company Marketing
    else if (
        domain.includes("blog") ||
        url.toLowerCase().includes("/blog/") ||
        url.toLowerCase().includes("/newsroom/") ||
        url.toLowerCase().includes("/press/") ||
        domain.endsWith(".medium.com") ||
        domain.endsWith(".substack.com")
    ) {
        category = CATEGORIES.COMPANY_VENDOR_BLOG;
        reason = `URL structure or sub-domain indicates corporate blog, press release, or commentary platform (${domain}). Subject to vendor perspective.`;
        isPrimarySourceLikely = false;
    }

    return {
        sourceId: source.id,
        domain,
        category: category.id,
        categoryLabel: category.label,
        categoryDescription: category.description,
        reason,
        isPrimarySourceLikely,
        retrievalScore: score,
        relevanceDisclaimer: "Search relevance score reflects Tavily query matching algorithms, not verified factual accuracy."
    };
}

/**
 * Assesses an array of sources and compiles diversity metrics.
 */
export function assessSources(sources = []) {
    const assessed = sources.map((source) => ({
        ...source,
        quality: assessSourceQuality(source)
    }));

    const uniqueDomains = new Set(assessed.map((s) => s.quality.domain).filter(Boolean));
    const categoriesCount = {};

    assessed.forEach((s) => {
        const cat = s.quality.category;
        categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
    });

    return {
        sources: assessed,
        diversity: {
            totalSources: assessed.length,
            uniqueDomainsCount: uniqueDomains.size,
            uniqueDomains: Array.from(uniqueDomains),
            categoriesBreakdown: categoriesCount,
            primarySourcesCount: assessed.filter((s) => s.quality.isPrimarySourceLikely).length
        }
    };
}

export default { assessSourceQuality, assessSources };
