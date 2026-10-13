import type { Dict, Lang } from "@/lib/i18n";
import { panelActions } from "./panel-en-actions";
import { panelCore } from "./panel-en-core";
import { panelExtra } from "./panel-en-extra";
import { panelMore } from "./panel-en-more";
import { panelUi } from "./panel-en-ui";

/**
 * Tekstovi panela na engleskom, u tri dela: ono što piše u stranicama panela (ui), poruke
 * koje vraćaju akcije i dnevnik (actions) i nazivi polja i sekcija iz jezgra (core).
 */
const en: Dict = { ...panelMore, ...panelExtra, ...panelCore, ...panelActions, ...panelUi };

export const panelDict: Partial<Record<Lang, Dict>> = { en };
