(function($, undefined){
    $.widget('surfjudge.edit_judges', {
        options: {
            heat_id: null,

            getjudgesurl: '/rest/judges',
            getassignedjudgesurl: '/rest/judge_assignments',
            postassignedjudgesurl: '/rest/judge_assignments_batch'
        },

        _create: function(){
            this.judges = null;
            this.assigned_judges = null;

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
                '        <select multiple="multiple" size="10" name="assigned_judges" class="assigned_judges_select"></select>',
                '    </div>',
                '</div>',
                '<div class="float-right">',
                '<button type="button" class="btn btn-light reset_btn">Reset</button>',
                '<button type="button" class="btn btn-primary submit_btn">Save changes</button>',
                '</div>',
            ].join(' ');

            this.element.append($(html));
            this.element.find('.assigned_judges_select').bootstrapDualListbox({
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
            var deferred_assigned_judges = $.getJSON(this.options.getassignedjudgesurl + '/' + _this.options.heat_id);
            var deferred_judges = $.getJSON(this.options.getjudgesurl);
            return $.when(deferred_assigned_judges, deferred_judges)
                .done(function(ev_assigned_judges, ev_judges){
                    _this.assigned_judges = ev_assigned_judges[0];
                    _this.judges = ev_judges[0];
                    _this._refresh();
                    _this._mark_clean();
                });
        },

        _refresh: function(){
            var _this = this;
            var elem = this.element.find('.assigned_judges_select');
            elem.empty();
            $.each(_this.judges, function(idx, judge){
                $('<option />', {
                    value: judge['id'],
                    text: judge['id'] + ': ' + judge['first_name'] + ' ' + judge['last_name'],
                }).appendTo(elem);
            });
            $.each(_this.assigned_judges, function(idx, judge){
                _this.element.find('.assigned_judges_select option[value=' + judge['judge_id'] + ']').prop('selected', true);
            });
            elem.bootstrapDualListbox('refresh');
        },

        upload: function(){
            var _this = this;
            var deferred = $.Deferred();
            // upload changes
            var selected_assignments = [];
            // TODO: make conforming format to be uploaded (corresponding to data model)
            this.element.find('#bootstrap-duallistbox-selected-list_assigned_judges option').each(function(){
                selected_assignments.push({
                    'heat_id': _this.options.heat_id,
                    'judge_id': parseInt(this.value),
                });
            });
            var upload_data = {heat_id: _this.options.heat_id, assignments: selected_assignments};
            $.post(this.options.postassignedjudgesurl + '/' + this.options.heat_id,
                   JSON.stringify(upload_data), function(){
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
