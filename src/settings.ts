"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

export class ChartConfigCardSettings extends FormattingSettingsCard {
    innerRadiusRatio = new formattingSettings.NumUpDown({
        name: "innerRadiusRatio",
        displayName: "Inner Hole Ratio",
        value: 0.25,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0.05
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 0.70
            }
        }
    });

    padAngle = new formattingSettings.NumUpDown({
        name: "padAngle",
        displayName: "Pad Angle (rad)",
        value: 0.005,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 0.05
            }
        }
    });

    cornerRadius = new formattingSettings.NumUpDown({
        name: "cornerRadius",
        displayName: "Corner Radius (px)",
        value: 3,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 15
            }
        }
    });

    animationDuration = new formattingSettings.NumUpDown({
        name: "animationDuration",
        displayName: "Animation Duration (ms)",
        value: 750,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 2000
            }
        }
    });

    colorScheme = new formattingSettings.ItemDropdown({
        name: "colorScheme",
        displayName: "Color Scheme",
        items: [
            { value: "tableau10", displayName: "Tableau 10" },
            { value: "category10", displayName: "Category 10" },
            { value: "paired", displayName: "Paired" },
            { value: "accent", displayName: "Accent" },
            { value: "spectral", displayName: "Spectral" }
        ],
        value: { value: "tableau10", displayName: "Tableau 10" }
    });

    name: string = "chartConfig";
    displayName: string = "Chart Configuration";
    slices: Array<FormattingSettingsSlice> = [
        this.innerRadiusRatio,
        this.padAngle,
        this.cornerRadius,
        this.animationDuration,
        this.colorScheme
    ];
}

export class LabelsConfigCardSettings extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show Labels",
        value: true
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font Size",
        value: 10
    });

    fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Font Color",
        value: { value: "#2d3748" }
    });

    name: string = "labelsConfig";
    displayName: string = "Data Labels";
    slices: Array<FormattingSettingsSlice> = [this.show, this.fontSize, this.fontColor];
}

export class BreadcrumbsConfigCardSettings extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show Breadcrumbs",
        value: true
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font Size",
        value: 12
    });

    fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Font Color",
        value: { value: "#1a202c" }
    });

    name: string = "breadcrumbsConfig";
    displayName: string = "Breadcrumbs";
    slices: Array<FormattingSettingsSlice> = [this.show, this.fontSize, this.fontColor];
}

export class CenterConfigCardSettings extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show Center Summary",
        value: true
    });

    title = new formattingSettings.TextInput({
        name: "title",
        displayName: "Title Label",
        placeholder: "Total",
        value: "Total"
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font Size",
        value: 14
    });

    name: string = "centerConfig";
    displayName: string = "Center Summary";
    slices: Array<FormattingSettingsSlice> = [this.show, this.title, this.fontSize];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    chartConfigCard = new ChartConfigCardSettings();
    labelsConfigCard = new LabelsConfigCardSettings();
    breadcrumbsConfigCard = new BreadcrumbsConfigCardSettings();
    centerConfigCard = new CenterConfigCardSettings();

    cards = [
        this.chartConfigCard,
        this.labelsConfigCard,
        this.breadcrumbsConfigCard,
        this.centerConfigCard
    ];
}
