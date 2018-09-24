(function($, undefined){
    $.widget('surfjudge.edit_judges', {
        options: {
            heat_id: null,

            getjudgesurl: '/rest/judges',
            getactivejudgesurl: '/rest/active_judges',
            postactivejudgesurl: '/rest/active_judges_batch'
        },

        _create: function(){
            this.judges = null;
            this.active_judges = null;

            this._init_html();
            this._register_events();
            this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var html = [
                '<div class="alert row dirty_marker">',
                '    <div class="col">',
                '        <select multiple="multiple" size="10" name="active_judges" class="active_judges_select"></select>',
                '    </div>',
                '</div>',
                '<div class="float-right">',
                '<button type="button" class="btn btn-light reset_btn">Reset</button>',
                '<button type="button" class="btn btn-primary submit_btn">Save changes</button>',
                '</div>',
            ].join(' ');

            this.element.append($(html));
            this.element.find('.active_judges_select').bootstrapDualListbox({
                nonSelectedListLabel: 'Unselected judges',
                selectedListLabel: 'Selected judges',
            });
        },

        _register_events: function(){
            this._on({
                'click .reset_btn': this.refresh,
                'click .submit_btn': this.upload,
                'change': this._mark_dirty,
            });
        },

        refresh: function(){
            var _this = this;
            var deferred_active_judges = $.getJSON(this.options.getactivejudgesurl + '/' + _this.options.heat_id);
            var deferred_judges = $.getJSON(this.options.getjudgesurl);
            return $.when(deferred_active_judges, deferred_judges)
                .done(function(ev_active_judges, ev_judges){
                    _this.active_judges = ev_active_judges[0];
                    _this.judges = ev_judges[0];
                    _this._refresh();
                    _this._mark_clean();
                });
        },

        _refresh: function(){
            var _this = this;
            var elem = this.element.find('.active_judges_select');
            elem.empty();
            $.each(_this.judges, function(idx, judge){
                $('<option />', {
                    value: judge['id'],
                    text: judge['id'] + ': ' + judge['first_name'] + ' ' + judge['last_name'],
                }).appendTo(elem);
            });
            $.each(_this.active_judges, function(idx, judge){
                _this.element.find('.active_judges_select option[value=' + judge['id'] + ']').prop('selected', true);
            });
            elem.bootstrapDualListbox('refresh');
        },

        upload: function(){
            var _this = this;
            var deferred = $.Deferred();
            // upload changes
            var selected_ids = [];
            // TODO: make conforming format to be uploaded (corresponding to data model)
            this.element.find('#bootstrap-duallistbox-selected-list_active_judges option').each(function(){
                selected_ids.push( parseInt(this.value) );
            });
            $.post(this.options.postactivejudgesurl, {heat_id: _this.options.heat_id, json_data: JSON.stringify(selected_ids)}, function(){
                _this.refresh();
                deferred.resolve();
                _this._trigger('data_changed');
            });
            return deferred.promise();
        },

        _mark_dirty: function(){
            this.element.find('.dirty_marker').addClass('alert-danger');
        },

        _mark_clean: function(){
            this.element.find('.dirty_marker').removeClass('alert-danger');
        },
    });
}(jQuery));
