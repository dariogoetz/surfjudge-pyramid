(function($, undefined){
    $.widget('surfjudge.judging_requests', {
        options: {
            heat_id: null,
            data: null,
        },

        _create: function(){
            this.judging_requests = this.options.data || {},

            this._init_html();
            this._register_events();
            this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var html = [
                '<!-- judging requests -->',
                '<table class="table table-striped judging_requests_table"',
                '       data-toggle="table"',
                '       data-sort-name="id"',
                '       date-sort-order="asc">',
                '    <thead>',
                '        <tr>',
                '            <th data-field="id">Judge ID</th>',
                '            <th data-field="name" data-sortable="true">Judge Name</th>',
                '            <th data-field="expires" data-sortable="true">Expires</th>',
                '            <th data-field="status" data-sortable="true">Status</th>',
                '            <th data-field="action"">Action</th>',
                '        </tr>',
                '    </thead>',
                '</table>',
                '<button class="btn btn-secondary add_judges_btn">Add judges</button>',
            ].join(' ');

            this.element.append($(html));

            this.element.find('.judging_requests_table').bootstrapTable({
                rowStyle: function rowStyle(row, index){
                    if (row['status'] === 'confirmed')
                        return {classes: 'confirmed'};
                    else if (row['status'] === 'missing')
                        return {classes: 'missing'};
                    else
                        return {classes: 'pending'}
                }
            });
        },

        _register_events: function(){
            this._on(this.element, {
                'click .missing button': function(event){
                    var elem = $(event.currentTarget);
                    this.delete_judge_activity(elem.data('judgeid'));
                },
                'click .confirmed button': function(event){
                    var elem = $(event.currentTarget);
                    this.delete_judge_activity(elem.data('judgeid'));
                },
                'click .pending button': function(event){
                    var elem = $(event.currentTarget);
                    this.confirm_judge_activity(elem.data('judgeid'));
                },
                'click .add_judges_btn': this.add_other_judges,
            });
        },

        refresh: function(){
            var _this = this;
            this.judging_requests = [];
            var deferred = $.Deferred();
            $.getJSON('/headjudge/do_get_judging_requests', {heat_id: _this.options.heat_id})
                .done(function(ev_judging_requests){
                    _this.judging_requests = ev_judging_requests;
                    _this._refresh();
                    deferred.resolve();
                });
            return deferred.promise();
        },

        _refresh: function(){
            $.each(this.judging_requests, function(idx, val){
                var param_str = val['heat_id'] + ',' + val['id'];
                val['action'] = '';
                if (val['status'] === 'pending'){
                    val['action'] = '<button data-judgeid=' + val['id'] + ' class="btn btn-success"><span class="fa fa-check"></span></button>';
                } else if (val['status'] === 'confirmed') {
                    val['action'] = '<button data-judgeid=' + val['id'] + ' class="btn btn-default"><span class="fa fa-times-circle"></span></button>';
                } else if (val['status'] === 'missing') {
                    val['action'] = '<button data-judgeid=' + val['id'] + ' class="btn btn-danger"><span class="fa fa-times-circle"></span></button>';
                }
            });
            this.element.find('.judging_requests_table').bootstrapTable('load', this.judging_requests);
        },

        confirm_judge_activity: function(judge_id){
            var _this = this;
            $.post('/tournament_admin/do_set_active_judges', {heat_id: this.options.heat_id, judge_ids: JSON.stringify([judge_id]), append: true}, function(){
                _this.refresh();
            });
            this._trigger('data_changed');
        },


        delete_judge_activity: function(judge_id){
            var _this = this;
            $.post('/tournament_admin/do_delete_active_judge', {heat_id: this.options.heat_id, judge_id: judge_id}, function(){
                _this.refresh();
            });
            this._trigger('data_changed');
        },

        add_other_judges: function(){
            var _this = this;
            var html = [
                '<div class="edit_judges">',
                '</div>'
            ].join(' ');
            var bb = bootbox.dialog({
                'title': 'Select Judges',
                'message': html,
                'buttons': {
                    cancel: {
                        label: 'Cancel',
                        className: 'btn-default'
                    },
                },
            });

            bb.init(function(){
                var edit_judges_elem = bb.find('.edit_judges');
                edit_judges_elem.edit_judges({heat_id: _this.options.heat_id});
                edit_judges_elem.on('edit_judgesdata_changed', function(){
                    _this.refresh();
                    _this._trigger('data_changed');
                    bootbox.hideAll();
                });
            });
        },
    });
}(jQuery));
