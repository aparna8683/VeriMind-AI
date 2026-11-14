import CONFIG from "../config/constants.js";

/**
 * Tracks free-tier budget and usage metrics across the server session
 * and within individual research requests.
 */
class BudgetService {
    constructor() {
        this.sessionStats = {
            startTime: new Date().toISOString(),
            totalResearchRequests: 0,
            totalSearches: 0,
            totalClaimsProcessed: 0,
            totalReverifications: 0,
            totalCacheHits: 0
        };
    }

    recordResearchRequest() {
        this.sessionStats.totalResearchRequests++;
    }

    recordSearch() {
        this.sessionStats.totalSearches++;
    }

    recordClaimsProcessed(count = 1) {
        this.sessionStats.totalClaimsProcessed += count;
    }

    recordReverification() {
        this.sessionStats.totalReverifications++;
    }

    recordCacheHit() {
        this.sessionStats.totalCacheHits++;
    }

    getSessionStats() {
        return {
            ...this.sessionStats,
            configuredLimits: {
                maxSearchesPerResearch: CONFIG.MAX_SEARCHES_PER_RESEARCH,
                maxSourcesPerSearch: CONFIG.MAX_SOURCES_PER_SEARCH,
                maxClaimsPerResearch: CONFIG.MAX_CLAIMS_PER_RESEARCH,
                maxEvidenceSourcesPerClaim: CONFIG.MAX_EVIDENCE_SOURCES_PER_CLAIM,
                maxReverificationAttempts: CONFIG.MAX_REVERIFICATION_ATTEMPTS,
                researchCacheTtlMinutes: CONFIG.RESEARCH_CACHE_TTL_MINUTES
            }
        };
    }

    /**
     * Creates a scoped tracker for a single research request.
     */
    createRequestTracker() {
        return new RequestBudgetTracker(CONFIG.MAX_SEARCHES_PER_RESEARCH, CONFIG.MAX_REVERIFICATION_ATTEMPTS);
    }
}

export class RequestBudgetTracker {
    constructor(maxSearches, maxReverifications) {
        this.maxSearches = maxSearches;
        this.maxReverifications = maxReverifications;
        this.searchesUsed = 0;
        this.claimsProcessed = 0;
        this.reverificationSearchesUsed = 0;
        this.cacheHit = false;
        this.limitReached = false;
    }

    canSearch() {
        return this.searchesUsed < this.maxSearches;
    }

    canReverify() {
        return this.reverificationSearchesUsed < this.maxReverifications && this.canSearch();
    }

    consumeSearch(isReverification = false) {
        if (!this.canSearch()) {
            this.limitReached = true;
            return false;
        }

        this.searchesUsed++;
        budgetService.recordSearch();

        if (isReverification) {
            this.reverificationSearchesUsed++;
            budgetService.recordReverification();
        }

        return true;
    }

    recordClaims(count) {
        this.claimsProcessed = count;
        budgetService.recordClaimsProcessed(count);
    }

    setCacheHit(value = true) {
        this.cacheHit = value;
        if (value) {
            budgetService.recordCacheHit();
        }
    }

    getReport() {
        return {
            searchesUsed: this.searchesUsed,
            maxSearchesAllowed: this.maxSearches,
            reverificationSearchesUsed: this.reverificationSearchesUsed,
            claimsProcessed: this.claimsProcessed,
            cacheHit: this.cacheHit,
            limitReached: this.limitReached,
            limits: {
                maxSearchesPerResearch: CONFIG.MAX_SEARCHES_PER_RESEARCH,
                maxSourcesPerSearch: CONFIG.MAX_SOURCES_PER_SEARCH,
                maxClaimsPerResearch: CONFIG.MAX_CLAIMS_PER_RESEARCH,
                maxEvidenceSourcesPerClaim: CONFIG.MAX_EVIDENCE_SOURCES_PER_CLAIM
            }
        };
    }
}

export const budgetService = new BudgetService();
export default budgetService;
