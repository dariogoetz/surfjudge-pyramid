(function($, undefined){
    $.widget('surfjudge.heat_overview_panel', {
        options: {
            heat_id: null,
        },

        _create: function(){
            this._init_html();
            this._init_modules();
            this._register_events();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            html = $([
                '<div class="container-fluid">',
                '    <div class="row">',
                '        <div class="col-8">',
                '            <h1 class="heat_label"></h1>',
                '        </div>',
                '        <!-- Heat Timer -->',
                '        <div class="col-4">',
                '            <div class="card text-center heat_timer">',
                '            </div>',
                '        </div>',
                '    </div>',
                '<br>',
                '    <h3>Activities</h3>',
                '    <div class="row">',
                '        <div class="col-3 heat_activity_btn">',
                '        </div>',
                '        <div class="col-3 publish_btn">',
                '        </div>',
                '        <div class="col-3">',
                '            <button class="btn btn-standard btn-lg export_btn pull-right">Export Excel</button>',
                '        </div>',
                '        <div class="col-3">',
                '            <button class="btn btn-default btn-lg pull-right refresh_btn"><span class="fa fa-sync-alt"></span>&nbsp;Refresh</button>',
                '        </div>',
                '    </div>',
                '',

                '<ul class="nav nav-pills" style="display: none;">',
                '    <li class="nav-item"><a class="nav-link active tab_ctrl_edit" href=".edit_section" data-toggle="tab">Heat</a></li>',
                '    <li class="nav-item"><a class="nav-link tab_ctrl_scores" href=".score_section" data-toggle="tab">Judges</a></li>',
                '</ul>',
                '<br>',
                '<div class="tab-content">',
                '    <div class="tab-pane fade show active edit_section">',
                '        <!-- judging requests -->',
                '        <h3>Judging Requests</h3>',
                '        <div class="judging_requests"></div>',
                '<br>',
                '        <!-- edit_participants -->',
                '        <h3>Participating Surfers</h3>',
                '        <div class="edit_heat_participation"></div>',
                '<br>',
                '        <!-- edit_heat -->',
                '        <a data-toggle="collapse" data-target=".edit_additional_heat_info"><h4>Edit additional heat info</h4></a>',
                '        <div class="edit_additional_heat_info collapse">',
                '            <div class="edit_heat"></div>',
                '        </div>',
                '    </div>',
                '    <div class="tab-pane fade score_section">',
                '        <!-- edit scores -->',
                '        <h3>Edit Scores</h3>',
                '        <div class="edit_scores"></div>',
                '    </div>',
                '</div>',
            ].join(' '));

            this.element.append(html);
        },

        _init_modules: function(){
            var _this = this;
            this._modules = {};

            var heat_timer = this.element.find('.heat_timer').heat_timer({heat_id: this.options.heat_id});
            this._modules['heat_timer'] = heat_timer.heat_timer('instance');

            var heat_activity_button = this.element.find('.heat_activity_btn').heat_activity_button({heat_id: this.options.heat_id});
            this._modules['heat_activity_button'] = heat_activity_button.heat_activity_button('instance');
            heat_activity_button.on('heat_activity_buttonheat_activity_changed', function(){
                heat_timer.heat_timer('refresh');
                _this._update_edit_section_visibility();
            });

            var publish_button = this.element.find('.publish_btn').publish_button({heat_id: this.options.heat_id});
            this._modules['publish_button'] = publish_button.publish_button('instance');

            var judging_requests = this.element.find('.judging_requests').judging_requests({heat_id: this.options.heat_id});
            this._modules['judging_requests'] = judging_requests.judging_requests('instance');

            var heat_participation = this.element.find('.edit_heat_participation').heat_participation({heat_id: this.options.heat_id});
            this._modules['heat_participation'] = heat_participation.heat_participation('instance');

            var edit_heat = this.element.find('.edit_heat').edit_heat({heat_id: this.options.heat_id, show_delete_btn: false});
            this._modules['edit_heat'] = edit_heat.edit_heat('instance');

            var edit_scores_panel = this.element.find('.edit_scores').edit_scores_panel({heat_id: this.options.heat_id});
            this._modules['edit_scores_panel'] = edit_scores_panel.edit_scores_panel('instance');

            // fill heat label
            var heat_module = this._modules['edit_heat'];
            heat_module.initialized().done(function(){
                var data = heat_module.get_data();
                _this.element.find('.heat_label').html('<strong>' + data['name'] + "</strong> in " + data['category']['name']);
            });

            // hide data section for active heats
            var activity_module = _this._modules['heat_activity_button'];
            activity_module.initialized().done(function(){
                _this._update_edit_section_visibility();
            });
        },

        refresh: function() {
            var _this = this;
            var heat_activity_deferred = null;
            $.each(this._modules, function(module_name, module){
                var deferred = module.refresh();
                if (module_name == 'heat_activity_button') {
                    heat_activity_deferred = deferred;
                }
            });
            var deferred = $.Deferred();
            heat_activity_deferred.done(function(){
                _this._update_edit_section_visibility();
                deferred.resolve();
            });
            return deferred.promise();
        },

        _register_events: function(){
            this._on(this.element, {
                'click .refresh_btn': this.refresh,
                'click .export_btn': this.export_scores,
                'judging_requestsdata_changed': this._refresh_edit_scores_panel,
                'heat_participationdata_changed': this._refresh_edit_scores_panel,
                'edit_heatdata_changed': this._refresh_edit_scores_panel,
            });
        },

        _refresh_edit_scores_panel: function(){
            this._modules['edit_scores_panel'].refresh();
        },

        export_scores: function(){
            window.location.replace('/export_scores?heat_id=' + this.options.heat_id);
        },

        _update_edit_section_visibility: function(){
            if (this._modules['heat_activity_button'].heat_is_active()){
                this.element.find('.tab_ctrl_scores').tab('show');
            } else {
                this.element.find('.tab_ctrl_edit').tab('show');
            }
        },
    });
}(jQuery));
