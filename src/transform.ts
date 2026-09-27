"use strict";

import powerbi from "powerbi-visuals-api";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataViewCategorical = powerbi.DataViewCategorical;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import { ISunburstRawNode, ISunburstViewModel } from "./types";

export function formatNumber(value: number): string {
    if (value === null || value === undefined || isNaN(value)) {
        return "0";
    }
    const abs = Math.abs(value);
    if (abs >= 1e9) {
        return (value / 1e9).toFixed(2) + "B";
    }
    if (abs >= 1e6) {
        return (value / 1e6).toFixed(2) + "M";
    }
    if (abs >= 1e3) {
        return (value / 1e3).toFixed(1) + "K";
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function transformDataView(
    categorical: DataViewCategorical | undefined,
    host: IVisualHost
): ISunburstViewModel {
    const emptyResult: ISunburstViewModel = {
        root: null,
        totalValue: 0,
        formattedTotal: "0",
        measureName: "",
        levelNames: [],
        hasData: false,
        highlightsApplied: false
    };

    if (!categorical || !categorical.categories || categorical.categories.length === 0) {
        return emptyResult;
    }

    const categories = categorical.categories;
    const valuesCol = categorical.values && categorical.values.length > 0 ? categorical.values[0] : null;

    if (!valuesCol || !valuesCol.values || valuesCol.values.length === 0) {
        return emptyResult;
    }

    const numRows = valuesCol.values.length;
    const levelNames = categories.map(c => c.source.displayName || "Category");
    const measureName = valuesCol.source.displayName || "Value";

    // Track highlights
    const highlightsApplied = !!(valuesCol.highlights && valuesCol.highlights.some(h => h !== null));

    // Root node
    const root: ISunburstRawNode = {
        name: "Total",
        children: [],
        path: ["Total"],
        value: 0
    };

    let totalSum = 0;

    for (let r = 0; r < numRows; r++) {
        const rawVal = Number(valuesCol.values[r]);
        const val = isNaN(rawVal) ? 0 : rawVal;
        if (val <= 0) {
            continue; // Skip zero or negative values in radial partition
        }

        totalSum += val;

        let currentNode = root;
        const currentPath = ["Total"];

        for (let lvl = 0; lvl < categories.length; lvl++) {
            const rawCatVal = categories[lvl].values[r];
            const catName = rawCatVal !== null && rawCatVal !== undefined && String(rawCatVal).trim() !== ""
                ? String(rawCatVal)
                : "(Blank)";

            currentPath.push(catName);

            if (!currentNode.children) {
                currentNode.children = [];
            }

            let childNode = currentNode.children.find(c => c.name === catName);
            if (!childNode) {
                // Build selection ID up to this level
                const selBuilder = host.createSelectionIdBuilder();
                for (let k = 0; k <= lvl; k++) {
                    selBuilder.withCategory(categories[k], r);
                }

                if (categorical.values && categorical.values[0]) {
                    selBuilder.withMeasure(categorical.values[0].source.queryName);
                }

                childNode = {
                    name: catName,
                    levelName: levelNames[lvl],
                    path: [...currentPath],
                    children: [],
                    value: 0,
                    selectionId: selBuilder.createSelectionId()
                };
                currentNode.children.push(childNode);
            }

            // Accumulate value
            childNode.value = (childNode.value || 0) + val;
            currentNode = childNode;
        }

        // Add tooltip data to the leaf node
        const tooltips: VisualTooltipDataItem[] = [
            {
                displayName: "Hierarchy",
                value: currentPath.slice(1).join(" \u2192 ")
            },
            {
                displayName: measureName,
                value: formatNumber(currentNode.value || val)
            }
        ];

        // Additional tooltip measures if provided
        if (categorical.values && categorical.values.length > 1) {
            for (let t = 1; t < categorical.values.length; t++) {
                const extraMeasure = categorical.values[t];
                if (extraMeasure.values[r] !== undefined && extraMeasure.values[r] !== null) {
                    tooltips.push({
                        displayName: extraMeasure.source.displayName || `Measure ${t}`,
                        value: String(extraMeasure.values[r])
                    });
                }
            }
        }

        currentNode.tooltipItems = tooltips;
    }

    root.value = totalSum;
    root.formattedValue = formatNumber(totalSum);

    return {
        root,
        totalValue: totalSum,
        formattedTotal: formatNumber(totalSum),
        measureName,
        levelNames,
        hasData: totalSum > 0 && !!(root.children && root.children.length > 0),
        highlightsApplied
    };
}
