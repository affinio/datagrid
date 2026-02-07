# FIX: Vertical Scroll Desync — TODO Log

- [x] Stretch rows-layer to total virtual height  
  Explanation: rows-layer now receives the computed table height so the scroll host measures the full dataset instead of the small render window (changes land in DataGridViewport.vue and the viewport watchers).

- [x] Remove virtualization translate from rows-layer  
  Explanation: rows-layer stays static with no transform property, preventing the browser from clamping scrollTop when rows-layer moved outside its container.

- [x] Position pooled rows by absolute index  
  Explanation: useTableGridLayout now translates each pooled row by its real index, so virtualization no longer depends on shifting the parent container.

- [x] Keep scroll transforms scoped to body-main-content  
  Explanation: scrollSync remains the only source of body-main-content transforms, keeping viewport offsets consistent while eliminating jitter at the bottom edge.
