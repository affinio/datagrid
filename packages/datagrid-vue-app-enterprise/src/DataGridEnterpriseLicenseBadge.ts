import {
  computed,
  defineComponent,
  h,
  type PropType,
} from "vue"
import type {
  AffinoDataGridEnterpriseBlockedFeature,
  AffinoDataGridEnterpriseLicenseSummary,
} from "./dataGridEnterpriseLicense"

export default defineComponent({
  name: "DataGridEnterpriseLicenseBadge",
  props: {
    blockedFeatures: {
      type: Array as PropType<readonly AffinoDataGridEnterpriseBlockedFeature[]>,
      required: true,
    },
    licenseSummary: {
      type: Object as PropType<AffinoDataGridEnterpriseLicenseSummary>,
      required: true,
    },
  },
  setup(props) {
    const label = computed(() => {
      if (props.licenseSummary.status === "expired") {
        return "License expired"
      }
      if (props.licenseSummary.status === "invalid") {
        return "License invalid"
      }
      if (props.licenseSummary.isTrial) {
        return "Trial active"
      }
      if (props.blockedFeatures.length > 0) {
        return `Enterprise locked (${props.blockedFeatures.length})`
      }
      return "Enterprise license"
    })

    const title = computed(() => {
      const lines = [
        `Status: ${props.licenseSummary.statusLabel}`,
        `Tier: ${props.licenseSummary.tierLabel}`,
        `Source: ${props.licenseSummary.sourceLabel}`,
      ]

      if (props.licenseSummary.customer) {
        lines.push(`Customer: ${props.licenseSummary.customer}`)
      }
      if (props.licenseSummary.expiresAt) {
        lines.push(`Expires: ${props.licenseSummary.expiresAt}`)
      }
      if (props.licenseSummary.daysRemaining !== null) {
        lines.push(`Days remaining: ${props.licenseSummary.daysRemaining}`)
      }
      lines.push(`Features: ${props.licenseSummary.featureLabel}`)

      for (const entry of props.blockedFeatures) {
        lines.push(entry.reason)
      }

      return lines.join("\n")
    })

    return () => h("button", {
      type: "button",
      class: "datagrid-enterprise-license-badge",
      "data-datagrid-enterprise-license-badge": "",
      title: title.value,
      disabled: true,
    }, label.value)
  },
})
