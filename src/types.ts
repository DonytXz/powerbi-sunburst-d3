import powerbi from "powerbi-visuals-api";
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

export interface ISunburstRawNode {
    name: string;
    value?: number;
    children?: ISunburstRawNode[];
    selectionId?: ISelectionId;
    levelName?: string;
    path?: string[];
    formattedValue?: string;
    tooltipItems?: VisualTooltipDataItem[];
}

export interface ISunburstSettings {
    innerRadiusRatio: number;
    padAngle: number;
    cornerRadius: number;
    animationDuration: number;
    colorScheme: string;
    showLabels: boolean;
    labelFontSize: number;
    labelFontColor: string;
    showBreadcrumbs: boolean;
    breadcrumbFontSize: number;
    breadcrumbFontColor: string;
    showCenterSummary: boolean;
    centerTitle: string;
    centerFontSize: number;
}

export interface ISunburstViewModel {
    root: ISunburstRawNode | null;
    totalValue: number;
    formattedTotal: string;
    measureName: string;
    levelNames: string[];
    hasData: boolean;
    highlightsApplied: boolean;
}
