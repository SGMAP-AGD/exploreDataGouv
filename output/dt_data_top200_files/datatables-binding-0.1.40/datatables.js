(function() {

// some helper functions: using a global object DTWidget so that it can be used
// in JS() code, e.g. datatable(options = list(foo = JS('code'))); unlike R's
// dynamic scoping, when 'code' is eval()'ed, JavaScript does not know objects
// from the "parent frame", e.g. JS('DTWidget') will not work unless it was made
// a global object
var DTWidget = {};

DTWidget.formatCurrency = function(thiz, row, data, col, currency, digits, interval, mark, decMark) {
  var d = parseFloat(data[col]);
  if (isNaN(d)) return;
  // 123456666.7890 -> 123,456,666.7890
  var markInterval = function(x, interval, mark) {
    if (!/^-?[\d.]+$/.test(x)) return x;
    var xv = x.split('.');
    if (xv.length > 2) return x;  // should have at most one decimal point
    xv[0] = xv[0].replace(new RegExp('\\B(?=(\\d{' + interval + '})+(?!\\d))', 'g'), mark);
    return xv.join(decMark);
  };
  d = d.toFixed(digits);
  $(thiz.api().cell(row, col).node()).html(currency + markInterval(d, interval, mark));
};

DTWidget.formatPercentage = function(thiz, row, data, col, digits) {
  var d = parseFloat(data[col]);
  if (isNaN(d)) return;
  $(thiz.api().cell(row, col).node()).html((d * 100).toFixed(digits) + '%');
};

DTWidget.formatRound = function(thiz, row, data, col, digits) {
  var d = parseFloat(data[col]);
  if (isNaN(d)) return;
  $(thiz.api().cell(row, col).node()).html(d.toFixed(digits));
};

DTWidget.formatDate = function(thiz, row, data, col, method) {
  var d = data[col];
  if (d === null) return;
  d = new Date(d);
  $(thiz.api().cell(row, col).node()).html(d[method]());
};

window.DTWidget = DTWidget;

var transposeArray2D = function(a) {
  return a.length === 0 ? a : HTMLWidgets.transposeArray2D(a);
};

HTMLWidgets.widget({
  name: "datatables",
  type: "output",
  initialize: function(el, width, height) {
    $(el).html('&nbsp;');
    return { data: null };
  },
  renderValue: function(el, data, instance) {
    if (el.offsetWidth === 0 || el.offsetHeight === 0) {
      instance.data = data;
      return;
    }
    instance.data = null;
    var $el = $(el);
    $el.empty();

    if (data === null) {
      return;
    }

    var cells = data.data;

    if (cells instanceof Array) cells = transposeArray2D(cells);

    $el.append(data.container);
    var $table = $el.find('table');
    if (data.class) $table.addClass(data.class);
    if (data.caption) $table.prepend(data.caption);

    if (HTMLWidgets.shinyMode && data.selection.mode !== 'none' &&
        data.selection.target === 'row+column') {
      if ($table.children('tfoot').length === 0) {
        $table.append($('<tfoot>'));
        $table.find('thead tr').clone().appendTo($table.find('tfoot'));
      }
    }

    // column filters
    var filterRow;
    switch (data.filter) {
      case 'top':
        $table.children('thead').append(data.filterHTML);
        filterRow = $table.find('thead tr:last td');
        break;
      case 'bottom':
        if ($table.children('tfoot').length === 0) {
          $table.append($('<tfoot>'));
        }
        $table.children('tfoot').prepend(data.filterHTML);
        filterRow = $table.find('tfoot tr:first td');
        break;
    }

    var options = { searchDelay: 1000 };
    if (cells !== null) $.extend(options, {
      data: cells
    });
    $.extend(true, options, data.options || {});

    var searchCols = options.searchCols;
    if (searchCols) {
      searchCols = searchCols.map(function(x) {
        return x === null ? '' : x.search;
      });
      // FIXME: this means I don't respect the escapeRegex setting
      delete options.searchCols;
    }

    // server-side processing?
    var server = options.serverSide === true;

    // use the dataSrc function to pre-process JSON data returned from R
    var DT_rows_all = [], DT_rows_current = [];
    if (server && HTMLWidgets.shinyMode && typeof options.ajax === 'object' &&
        /^session\/[\da-z]+\/dataobj/.test(options.ajax.url) && !options.ajax.dataSrc) {
      options.ajax.dataSrc = function(json) {
        DT_rows_all = $.makeArray(json.DT_rows_all);
        DT_rows_current = $.makeArray(json.DT_rows_current);
        return json.data;
      };
    }

    var table = $table.DataTable(options);

    var inArray = function(val, array) {
      return $.inArray(val, $.makeArray(array)) > -1;
    };

    if (data.filter !== 'none') {

      filterRow.each(function(i, td) {

        var $td = $(td), type = $td.data('type'), filter;
        var $input = $td.children('div').first().children('input');
        $input.prop('disabled', !table.settings()[0].aoColumns[i].bSearchable || type === 'disabled');
        $input.on('input blur', function() {
          $input.next('span').toggle(Boolean($input.val()));
        });
        var searchCol;  // search string for this column
        if (searchCols && searchCols[i]) {
          searchCol = searchCols[i];
          $input.val(searchCol);
        }
        // Bootstrap sets pointer-events to none and we won't be able to click
        // the clear button
        $input.next('span').css('pointer-events', 'auto').hide().click(function() {
          $(this).hide().prev('input').val('').trigger('input').focus();
        });
        var $x = $td.children('div').last();

        if (inArray(type, ['factor', 'logical'])) {
          $input.on({
            click: function() {
              $input.parent().hide(); $x.show(); filter[0].selectize.focus();
            },
            input: function() {
              if ($input.val() === '') filter[0].selectize.setValue([]);
            }
          });
          filter = $x.children('select').selectize({
            plugins: ['remove_button'],
            hideSelected: true,
            onChange: function(value) {
              $input.val(value === null ? '' : JSON.stringify(value));
              if (value) $input.trigger('input');
              $input.attr('title', $input.val());
              if (server) {
                table.column(i).search(value ? JSON.stringify(value) : '').draw();
                return;
              }
              // turn off filter if nothing selected
              $td.data('filter', value !== null && value.length > 0);
              table.draw();  // redraw table, and filters will be applied
            }
          });
          // an ugly hack to deal with shiny: for some reason, the onBlur event
          // of selectize does not work in shiny
          $x.find('div > div.selectize-input > input').on('blur', function() {
            $x.hide(); $input.parent().show();
          });
          filter.next('div').css('margin-bottom', 'auto');
        } else if (type === 'character') {
          var fun = function() {
            var regex = false, ci = true;
            if (options.search) {
              regex = options.search.regex,
              ci = options.search.caseInsensitive !== false;
            }
            table.column(i).search($input.val(), regex, !regex, ci).draw();
          };
          if (server) {
            fun = $.fn.dataTable.util.throttle(fun, options.searchDelay);
          }
          $input.on('input', fun);
        } else if (inArray(type, ['number', 'integer', 'date', 'time'])) {
          var $x0 = $x;
          $x = $x0.children('div').first();
          $x0.css({
            'background-color': '#fff',
            'border': '1px #ddd solid',
            'border-radius': '4px',
            'padding': '20px 20px 10px 20px'
          });
          var $spans = $x0.children('span').css({
            'margin-top': '10px',
            'white-space': 'nowrap'
          });
          var $span1 = $spans.first(), $span2 = $spans.last();
          var r1 = +$x.data('min'), r2 = +$x.data('max');
          // when the numbers are too small or have many decimal places, the
          // slider may have numeric precision problems (#150)
          var scale = Math.pow(10, Math.max(0, +$x.data('scale') || 0));
          r1 = Math.round(r1 * scale); r2 = Math.round(r2 * scale);
          var scaleBack = function(x, scale) {
            if (scale === 1) return x;
            var d = Math.round(Math.log(scale) / Math.log(10));
            // to avoid problems like 3.423/100 -> 0.034230000000000003
            return (x / scale).toFixed(d);
          };
          $input.on({
            focus: function() {
              $x0.show();
              // first, make sure the slider div leaves at least 20px between
              // the two (slider value) span's
              $x0.width(Math.max(160, $span1.outerWidth() + $span2.outerWidth() + 20));
              // then, if the input is really wide, make the slider the same
              // width as the input
              if ($x0.outerWidth() < $input.outerWidth()) {
                $x0.outerWidth($input.outerWidth());
              }
              // make sure the slider div does not reach beyond the right margin
              if ($(window).width() < $x0.offset().left + $x0.width()) {
                $x0.offset({
                  'left': $input.offset().left + $input.outerWidth() - $x0.outerWidth()
                });
              }
            },
            blur: function() {
              $x0.hide();
            },
            input: function() {
              if ($input.val() === '') filter.val([r1, r2]);
            },
            change: function() {
              var v = $input.val().replace(/\s/g, '');
              if (v === '') return;
              v = v.split('...');
              if (v.length !== 2) {
                $input.parent().addClass('has-error');
                return;
              }
              if (v[0] === '') v[0] = r1;
              if (v[1] === '') v[1] = r2;
              $input.parent().removeClass('has-error');
              // treat date as UTC time at midnight
              var strTime = function(x) {
                var s = type === 'date' ? 'T00:00:00Z' : '';
                var t = new Date(x + s).getTime();
                // add 10 minutes to date since it does not hurt the date, and
                // it helps avoid the tricky floating point arithmetic problems,
                // e.g. sometimes the date may be a few milliseconds earlier
                // than the midnight due to precision problems in noUiSlider
                return type === 'date' ? t + 3600000 : t;
              };
              if (inArray(type, ['date', 'time'])) {
                v[0] = strTime(v[0]);
                v[1] = strTime(v[1]);
              }
              if (v[0] != r1) v[0] *= scale;
              if (v[1] != r2) v[1] *= scale;
              filter.val(v);
            }
          });
          var formatDate = function(d) {
            d = scaleBack(d, scale);
            if (type === 'number') return d;
            if (type === 'integer') return parseInt(d);
            var x = new Date(+d);
            if (type === 'date') {
              var pad0 = function(x) {
                return ('0' + x).substr(-2, 2);
              };
              return x.getUTCFullYear() + '-' + pad0(1 + x.getUTCMonth())
                      + '-' + pad0(x.getUTCDate());
            } else {
              return x.toISOString();
            }
          };
          var opts = type === 'date' ? { step: 60 * 60 * 1000 } :
                     type === 'integer' ? { step: 1 } : {};
          filter = $x.noUiSlider($.extend({
            start: [r1, r2],
            range: {min: r1, max: r2},
            connect: true
          }, opts));
          if (scale > 1) (function() {
            var t1 = r1, t2 = r2;
            var val = filter.val();
            while (val[0] > r1 || val[1] < r2) {
              if (val[0] > r1) {
                t1 -= val[0] - r1;
              }
              if (val[1] < r2) {
                t2 += r2 - val[1];
              }
              filter = $x.noUiSlider($.extend({
                start: [t1, t2],
                range: {min: t1, max: t2},
                connect: true
              }, opts), true);
              val = filter.val();
            }
            r1  = t1; r2 = t2;
          })();
          $span1.text(formatDate(r1)); $span2.text(formatDate(r2));
          var updateSlider = function(e) {
            var val = filter.val();
            // turn off filter if in full range
            $td.data('filter', val[0] > r1 || val[1] < r2);
            var v1 = formatDate(val[0]), v2 = formatDate(val[1]), ival;
            if ($td.data('filter')) {
              ival = v1 + ' ... ' + v2;
              $input.attr('title', ival).val(ival).trigger('input');
            } else {
              $input.attr('title', '').val('');
            }
            $span1.text(v1); $span2.text(v2);
            if (e.type === 'slide') return;  // no searching when sliding only
            if (server) {
              table.column(i).search($td.data('filter') ? ival : '').draw();
              return;
            }
            table.draw();
          };
          filter.on({
            set: updateSlider,
            slide: updateSlider
          });
        }

        // server-side processing will be handled by R (or whatever server
        // language you use); the following code is only needed for client-side
        // processing
        if (server) {
          // if a search string has been pre-set, search now
          if (searchCol) table.column(i).search(searchCol).draw();
          return;
        }

        var customFilter = function(settings, data, dataIndex) {
          // there is no way to attach a search function to a specific table,
          // and we need to make sure a global search function is not applied to
          // all tables (i.e. a range filter in a previous table should not be
          // applied to the current table); we use the settings object to
          // determine if we want to perform searching on the current table,
          // since settings.sTableId will be different to different tables
          if (table.settings()[0] !== settings) return true;
          // no filter on this column or no need to filter this column
          if (typeof filter === 'undefined' || !$td.data('filter')) return true;

          var r = filter.val(), v, r0, r1;
          if (type === 'number' || type === 'integer') {
            v = parseFloat(data[i]);
            // how to handle NaN? currently exclude these rows
            if (isNaN(v)) return(false);
            r0 = parseFloat(scaleBack(r[0], scale))
            r1 = parseFloat(scaleBack(r[1], scale));
            if (v >= r0 && v <= r1) return true;
          } else if (type === 'date' || type === 'time') {
            v = new Date(data[i]);
            r0 = new Date(r[0] / scale); r1 = new Date(r[1] / scale);
            if (v >= r0 && v <= r1) return true;
          } else if (type === 'factor') {
            if (r.length === 0 || inArray(data[i], r)) return true;
          } else if (type === 'logical') {
            if (r.length === 0) return true;
            if (inArray(data[i] === '' ? 'na' : data[i], r)) return true;
          }
          return false;
        };

        $.fn.dataTable.ext.search.push(customFilter);

        // search for the preset search strings if it is non-empty
        if (searchCol) {
          if (inArray(type, ['factor', 'logical'])) {
            filter[0].selectize.setValue(JSON.parse(searchCol));
          } else if (type === 'character') {
            $input.trigger('input');
          } else if (inArray(type, ['number', 'integer', 'date', 'time'])) {
            $input.trigger('change');
          }
        }

      });

    }

    // highlight search keywords
    var highlight = function() {
      var body = $(table.table().body());
      // removing the old highlighting first
      body.unhighlight();

      // don't highlight the "not found" row, so we get the rows using the api
      if (table.rows({ filter: 'applied' }).data().length === 0) return;
      // highlight gloal search keywords
      body.highlight($.trim(table.search()).split(/\s+/));
      // then highlight keywords from individual column filters
      if (filterRow) filterRow.each(function(i, td) {
        var $td = $(td), type = $td.data('type');
        if (type !== 'character') return;
        var $input = $td.children('div').first().children('input');
        var column = table.column(i).nodes().to$(),
            val = $.trim($input.val());
        if (type !== 'character' || val === '') return;
        column.highlight(val.split(/\s+/));
      });
    };

    if (options.searchHighlight) {
      table
      .on('draw.dt.dth column-visibility.dt.dth column-reorder.dt.dth', highlight)
      .on('destroy', function() {
        // remove event handler
        table.off( 'draw.dt.dth column-visibility.dt.dth column-reorder.dt.dth' );
      });

      // initial highlight for state saved conditions and initial states
      highlight();
    }

    // initialize extensions
    for (var ext in data.extOptions) {
      new $.fn.dataTable[ext](table, data.extOptions[ext] || {});
    }

    // run the callback function on the table instance
    if (typeof data.callback === 'function') data.callback(table);

    // interaction with shiny
    if (!HTMLWidgets.shinyMode) return;

    var methods = {};

    var changeInput = function(id, data, type) {
      id = el.id + '_' + id;
      if (type) id = id + ':' + type;
      Shiny.onInputChange(id, data);
    };

    var addOne = function(x) {
      return x.map(function(i) { return 1 + i; });
    };

    var unique = function(x) {
      var ux = [];
      $.each(x, function(i, el){
        if ($.inArray(el, ux) === -1) ux.push(el);
      });
      return ux;
    }

    // change the row index of a cell
    var tweakCellIndex = function(cell) {
      var info = cell.index();
      if (server) {
        info.row = DT_rows_current[info.row];
      } else {
        info.row += 1;
      }
      return {row: info.row, col: info.column};
    }

    var selMode = data.selection.mode, selTarget = data.selection.target;
    if (inArray(selMode, ['single', 'multiple'])) {
      var selClass = data.style === 'bootstrap' ? 'active' : 'selected';
      var selected = data.selection.selected, selected1, selected2;
      if (selected === null) {
        selected1 = selected2 = [];
      } else if (selTarget === 'row') {
        selected1 = $.makeArray(selected);
      } else if (selTarget === 'column') {
        selected2 = $.makeArray(selected);
      } else if (selTarget === 'row+column') {
        selected1 = $.makeArray(selected.rows);
        selected2 = $.makeArray(selected.cols);
      }
      // row, column, or cell selection
      if (inArray(selTarget, ['row', 'row+column'])) {
        var selectedRows = function() {
          var rows = table.rows('.' + selClass, {search: 'applied'});
          var idx = rows.indexes().toArray();
          if (!server) return addOne(idx);
          idx = idx.map(function(i) {
            return DT_rows_current[i];
          });
          selected1 = selMode === 'multiple' ? unique(selected1.concat(idx)) : idx;
          return selected1;
        }
        table.on('click.dt', 'tbody tr', function() {
          var $this = $(this), thisRow = table.row(this);
          if (selMode === 'multiple') {
            $this.toggleClass(selClass);
          } else {
            if ($this.hasClass(selClass)) {
              $this.removeClass(selClass);
            } else {
              table.$('tr.' + selClass).removeClass(selClass);
              $this.addClass(selClass);
            }
          }
          if (server && !$this.hasClass(selClass)) {
            var id = DT_rows_current[thisRow.index()];
            // remove id from selected1 since its class .selected has been removed
            selected1.splice($.inArray(id, selected1), 1);
          }
          changeInput('rows_selected', selectedRows());
          changeInput('row_last_clicked', server ?
                      DT_rows_current[thisRow.index()] : thisRow.index() + 1);
        });
        changeInput('rows_selected', selected1);
        var selectRows = function() {
          table.$('tr.' + selClass).removeClass(selClass);
          if (selected1.length === 0) return;
          if (server) {
            table.rows({page: 'current'}).every(function() {
              if (inArray(DT_rows_current[this.index()], selected1)) {
                $(this.node()).addClass(selClass);
              }
            });
          } else {
            var selected0 = selected1.map(function(i) { return i - 1; });
            $(table.rows(selected0).nodes()).addClass(selClass);
          }
        }
        selectRows();  // in case users have specified pre-selected rows
        // restore selected rows after the table is redrawn (e.g. sort/search/page);
        // client-side tables will preserve the selections automatically; for
        // server-side tables, we have to *real* row indices are in `selected1`
        if (server) table.on('draw.dt', selectRows);
        methods.selectRows = function(selected) {
          selected1 = selected ? selected : [];
          selectRows();
          changeInput('rows_selected', selected1);
        }
      }

      if (inArray(selTarget, ['column', 'row+column'])) {
        if (selTarget === 'row+column') {
          $(table.columns().footer()).css('cursor', 'pointer');
        }
        table.on('click.dt', selTarget === 'column' ? 'tbody td' : 'tfoot tr th', function() {
          var colIdx = selTarget === 'column' ? table.cell(this).index().column :
              $.inArray(this, table.columns().footer()),
              thisCol = $(table.column(colIdx).nodes());
          if (colIdx === -1) return;
          if (thisCol.hasClass(selClass)) {
            thisCol.removeClass(selClass);
            selected2.splice($.inArray(colIdx, selected2), 1);
          } else {
            if (selMode === 'single') $(table.cells().nodes()).removeClass(selClass);
            thisCol.addClass(selClass);
            selected2 = selMode === 'single' ? [colIdx] : unique(selected2.concat([colIdx]));
          }
          changeInput('columns_selected', selected2);
        });
        changeInput('columns_selected', selected2);
        var selectCols = function() {
          table.columns().nodes().flatten().to$().removeClass(selClass);
          if (selected2.length > 0)
            table.columns(selected2).nodes().flatten().to$().addClass(selClass);
        }
        selectCols();  // in case users have specified pre-selected columns
        if (server) table.on('draw.dt', selectCols);
        methods.selectColumns = function(selected) {
          selected2 = selected ? selected : [];
          selectCols();
          changeInput('columns_selected', selected2);
        }
      }

      if (selTarget === 'cell') {
        var selected3;
        if (selected === null) {
          selected3 = [];
        } else {
          selected3 = selected;
        }
        var findIndex = function(ij) {
          for (var i = 0; i < selected3.length; i++) {
            if (ij[0] === selected3[i][0] && ij[1] === selected3[i][1]) return i;
          }
          return -1;
        }
        table.on('click.dt', 'tbody td', function() {
          var $this = $(this), info = tweakCellIndex(table.cell(this));
          if ($this.hasClass(selClass)) {
            $this.removeClass(selClass);
            selected3.splice(findIndex([info.row, info.col]), 1);
          } else {
            if (selMode === 'single') $(table.cells().nodes()).removeClass(selClass);
            $this.addClass(selClass);
            selected3 = selMode === 'single' ? [[info.row, info.col]] :
              unique(selected3.concat([[info.row, info.col]]));
          }
          changeInput('cells_selected', transposeArray2D(selected3), 'shiny.matrix');
        });
        changeInput('cells_selected', transposeArray2D(selected3), 'shiny.matrix');
        var selectCells = function() {
          table.$('td.' + selClass).removeClass(selClass);
          if (selected3.length === 0) return;
          if (server) {
            table.cells({page: 'current'}).every(function() {
              var info = tweakCellIndex(this);
              if (findIndex([info.row, info.col], selected3) > -1)
                $(this.node()).addClass(selClass);
            });
          } else {
            selected3.map(function(ij) {
              $(table.cell(ij[0] - 1, ij[1]).node()).addClass(selClass);
            });
          }
        };
        selectCells();  // in case users have specified pre-selected columns
        if (server) table.on('draw.dt', selectCells);
        methods.selectCells = function(selected) {
          selected3 = selected ? selected : [];
          selectCells();
          changeInput('cells_selected', transposeArray2D(selected3), 'shiny.matrix');
        }
      }
    }

    // expose some table info to Shiny
    var updateTableInfo = function(e, settings) {
      // TODO: is anyone interested in the page info?
      // changeInput('page_info', table.page.info());
      var updateRowInfo = function(id, modifier) {
        var idx;
        if (server) {
          idx = modifier.page === 'current' ? DT_rows_current : DT_rows_all;
        } else {
          var rows = table.rows($.extend({
            search: 'applied',
            page: 'all'
          }, modifier));
          idx = addOne(rows.indexes().toArray());
        }
        changeInput('rows' + '_' + id, idx);
      };
      updateRowInfo('current', {page: 'current'});
      updateRowInfo('all', {});
    }
    table.on('draw.dt', updateTableInfo);
    updateTableInfo();

    // state info
    table.on('draw.dt', function() {
      changeInput('state', table.state());
    });
    changeInput('state', table.state());

    // search info
    var updateSearchInfo = function() {
      changeInput('search', table.search());
      if (filterRow) changeInput('search_columns', filterRow.toArray().map(function(td) {
        return $(td).find('input').first().val();
      }));
    }
    table.on('draw.dt', updateSearchInfo);
    updateSearchInfo();

    // the current cell clicked on
    table.on('click.dt', 'tbody td', function() {
      var info = tweakCellIndex(table.cell(this));
      info.value = table.cell(this).data();
      changeInput('cell_clicked', info);
    })
    changeInput('cell_clicked', {});

    methods.addRow = function(data, rowname) {
      var data0 = table.row(0).data(), n = data0.length, d = n - data.length;
      if (d === 1) {
        data = rowname.concat(data)
      } else if (d !== 0) {
        console.log(data);
        console.log(data0);
        throw 'New data must be of the same length as current data (' + n + ')';
      };
      table.row.add(data).draw();
    }

    table.shinyMethods = methods;
    $el.data('datatable', table);
  },
  resize: function(el, width, height, instance) {
    if (instance.data) this.renderValue(el, instance.data, instance);
  }
});

  if (!HTMLWidgets.shinyMode) return;

  Shiny.addCustomMessageHandler('datatable-calls', function(data) {
    var id = data.id;
    var el = document.getElementById(id);
    var table = el ? $(el).data('datatable') : null;
    if (!table) {
      console.log("Couldn't find table with id " + id);
      return;
    }

    var methods = table.shinyMethods, call = data.call;
    if (methods[call.method]) {
      methods[call.method].apply(table, call.args);
    } else {
      console.log("Unknown method " + call.method);
    }
  });

})();
