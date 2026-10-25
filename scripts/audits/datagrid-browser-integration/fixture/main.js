import { createApp, h, onMounted, ref } from 'vue'
import { DataGrid } from '@affino/datagrid-vue'

document.body.style.cssText = 'margin:20px;font:14px sans-serif'
const rows = Array.from({ length: 1000 }, (_, i) => ({ rowId: `audit-${i}`, name: `Record ${i}`, region: `G${Math.floor(i / 100)}`, total: i * 2, ...Object.fromEntries(Array.from({ length: 30 }, (_, c) => [`c${c}`, i * 100 + c])) }))
const columns = [
  { key: 'name', field: 'name', label: 'Name', initialState: { pin: 'left', width: 123.5 } },
  { key: 'region', field: 'region', label: 'Region', initialState: { width: 113.5 } },
  ...Array.from({ length: 30 }, (_, i) => ({ key: `c${i}`, field: `c${i}`, label: `C${i}`, initialState: { width: 98.75 }, dataType: 'number', capabilities: { editable: true, sortable: true } })),
  { key: 'total', field: 'total', label: 'Total', initialState: { pin: 'right', width: 117.25 } },
]
createApp({ setup() {
  const grid = ref(null)
  onMounted(() => { window.audit = { api: () => grid.value.getApi() } })
  return () => h('div', { style: 'height:520px;width:100%' }, [h(DataGrid, {
    ref: grid, rows, columns, rowKey: 'rowId', layoutMode: 'fill', rowHeightMode: 'fixed', baseRowHeight: 31,
    fillHandle: true, rangeMove: true, columnReorder: true, columnLayout: true,
    stickyGroupRows: { enabled: true, mode: 'root-only', transition: 'push-off' },
    style: 'height:100%',
  })])
} }).mount('#app')
