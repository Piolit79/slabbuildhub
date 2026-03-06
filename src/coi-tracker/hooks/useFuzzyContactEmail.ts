import { useMemo } from 'react';
import { useAllCOIs } from './useCOIs';

const THRESHOLD = 0.8;

function bigramSimilarity(a: string, b: string): number {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const pair = s.slice(i, i + 2);
      map.set(pair, (map.get(pair) ?? 0) + 1);
    }
    return map;
  };

  const aB = bigrams(na);
  const bB = bigrams(nb);
  let intersection = 0;
  for (const [pair, count] of aB) {
    intersection += Math.min(count, bB.get(pair) ?? 0);
  }
  return (2 * intersection) / (na.length - 1 + nb.length - 1);
}

export function useFuzzyContactEmail(coiId: string, subcontractorName: string) {
  const { data: allCois } = useAllCOIs();

  return useMemo(() => {
    if (!allCois || !subcontractorName) return { email1: '', email2: '' };

    let bestScore = 0;
    let best = { email1: '', email2: '' };

    for (const coi of allCois) {
      if (coi.id === coiId) continue;
      if (!coi.contact_email1 && !coi.contact_email2) continue;
      const score = bigramSimilarity(subcontractorName, coi.subcontractor);
      if (score >= THRESHOLD && score > bestScore) {
        bestScore = score;
        best = { email1: coi.contact_email1 || '', email2: coi.contact_email2 || '' };
      }
    }

    return best;
  }, [allCois, coiId, subcontractorName]);
}
