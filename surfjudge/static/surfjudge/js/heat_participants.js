/* =========================================================
 * heat_participants.js
 * =========================================================
 * Copyright 2016 Dario Goetz
 * ========================================================= */

(function($, undefined){
    $.widget('surfjudge.heat_participation', {
        options: {
            heat_id: null,

            data_surfers: [],
            data_participants: {},
            data_proposed_participants: {},
            data_advancement_rules: {},
            data_colors: {},
        },

        _create: function(){
            this.surfers = this.options.data_surfers || [];
            this.participants_list = this.options.data_participants || [];
            this.proposed_participants_list = this.options.data_proposed_participants || [];
            this.advancement_rules = this.options.data_advancement_rules || {};
            this.colors = this.options.data_colors || {};

            this.participants = this._dictify(this.participants_list);
            this.proposed_participants = this._dictify(this.proposed_participants_list);

            this._init_html();

            this._register_events();
            this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            html = [
                '<div class="alert dirty_marker">',
                '    <table class="table table-striped participants_table">',
                '    <thead>',
                '            <tr>',
                '                <th data-field="seed">Seed</th>',
                '                <th data-field="name">Surfer Name</th>',
                '                <th data-field="color">Surfer Color</th>',
                '                <th data-field="action">Action</th>',
                '            </tr>',
                '        </thead>',
                '        <tbody>',
                '        </tbody>',
                '    </table>',
                '    <br>',
                '    <button class="btn btn-secondary add_participant_btn"><span class="fa fa-plus">&nbsp;</span>Add Participant</button>',
                '    <div class="float-right">',
                '        <button class="btn btn-light reset_btn">Reset</button>',
                '        <button class="btn btn-primary save_changes_btn">Save changes</button>',
                '    </div>',
                '</div>'
            ].join(' ');

            this.element.append(html);

            this.element.find('.participants_table').bootstrapTable({'rowStyle': function rowStyle(row, index){
                var res = {};
                if (row['type'] == 'proposal')
                    res['classes'] = 'proposal';
                else if (row['type'] == 'rule')
                    res['classes'] = 'rule';
                return res;
            }});
        },

        refresh: function(){
            var deferred_rules = $.getJSON('/tournament_admin/do_get_advancement_rules', {heat_id: this.options.heat_id});
            var deferred_participants = $.getJSON('/headjudge/do_get_participating_surfers', {heat_id: this.options.heat_id});
            var deferred_proposals = $.getJSON('/tournament_admin/do_get_advancing_surfers', {heat_id: this.options.heat_id});
            var deferred_colors = $.getJSON('/tournament_admin/do_get_lycra_colors');

            var _this = this;

            var deferred = $.Deferred();
            var def_data = $.when(deferred_participants,
                                  deferred_proposals,
                                  deferred_colors,
                                  deferred_rules);
            def_data.done(function(ev_participants,
                                   ev_proposals,
                                   ev_colors,
                                   ev_rules){
                var participants = ev_participants[0];
                _this.participants = _this._dictify(participants);
                var proposed_participants = ev_proposals[0];
                _this.proposed_participants = _this._dictify(proposed_participants);
                _this.advancement_rules = ev_rules[0];
                _this.colors = ev_colors[0];

                _this._refresh();
                _this._mark_clean();
                deferred.resolve();
            });
            return deferred.promise();
        },

        _get_surfers_from_server: function(){
            var _this = this;
            var deferred = $.Deferred();
            if (this.surfers.length > 0){
                // only load surfers, when they have not been retrieved before
                deferred.resolve();
            } else {
                $.getJSON('/tournament_admin/do_get_surfers')
                    .done(function(ev_surfers){
                        _this.surfers = ev_surfers;
                        deferred.resolve();
                    });
            }
            return deferred.promise();
        },

        _dictify: function(l, key){
            if (!key)
                var key = 'seed';
            var d = {};
            $.each(l, function(idx, val){
                d[val[key]] = val;
            });
            return d;
        },

        _refresh: function(){
            // refresh table
            var res = [];
            var max_seed = -1;
            this._fetch_surfer_colors();
            var participants = this._get_combined_participants();

            $.each(participants, function(key, participant){
                if (participant['seed'] > max_seed){
                    max_seed = participant['seed'];
                }
            });

            for (var seed = 0; seed <= max_seed; seed++){
                var type = 'empty';
                var p = {};
                if (participants[seed] == null){
                    p['name'] = '-- empty slot --';
                    p['seed'] = seed;
                    p['surfer_color'] = null;
                } else {
                    p = participants[seed];
                    type = p['type'];
                }
                res.push(this._add_interactive_fields(p, type));
            }
            this.element.find('.participants_table').bootstrapTable('load', res);
        },

        _register_events: function(){

            this._on(this.element, {
                'change': this._mark_dirty,
                'click .reset_btn': this.refresh,
                'click .save_changes_btn': this.upload,
                'click .add_participant_btn': function(){
                    this._init_participant_modal('new');
                },
                'click .participants_table .remove_pending_btn': function(event){
                    var seed = $(event.currentTarget).data('seed');
                    this.remove_pending(seed);
                    this._mark_dirty();
                },
                'click .participants_table .edit_participant_btn': function(event){
                    var seed = $(event.currentTarget).data('seed');
                    this._init_participant_modal(seed);
                },
                'click .participants_table .remove_participant_btn': function(event){
                    var seed = $(event.currentTarget).data('seed');
                    this.remove_participant(seed);
                    this._mark_dirty();
                },
            });
        },

        _init_participant_modal: function(seed){
            var _this = this;
            var html = $([
                '<div class="participants_modal">',
                '    <table class="table table-striped surfers_table"',
                '           data-sort-name="name"',
                '           date-sort-order="asc"',
                '           data-search=true',
                '           data-height="300">',
                '        <thead>',
                '            <tr>',
                '                <th data-field="name">Surfer Name</th>',
                '            </tr>',
                '        </thead>',
                '        <tbody>',
                '        </tbody>',
                '    </table>',
                '</div>',
            ].join(' '));

            var bb = bootbox.confirm({
                title: 'Select participant',
                message: html,
                size: 'small',
                callback: function(confirmed){
                    if (!confirmed)
                        return;
                    var modal_elem = this.find('.participants_modal');

                    if (modal_elem.data('participant') != null){
                        _this.set_participant(modal_elem.data('seed'), modal_elem.data('participant'));
                    }
                    else
                        console.log('nothing to submit');
                },
            })

            bb.init(function(){
                // init modal data
                var modal_elem = bb.find('.participants_modal');
                var surfers_table = bb.find('.surfers_table');

                // store data
                // we don't use the surfers table as data storage for seed and participant
                // because it gets duplicated by bootstraptable
                // hence hard to select afterwards
                modal_elem.data('seed', seed);
                modal_elem.data('participant', null);

                // init surfers table
                _this._get_surfers_from_server()
                    .done(function(){
                        surfers_table
                            .bootstrapTable()
                            .bootstrapTable('load', _this._get_nonparticipating_surfers());

                        // register selection event
                        surfers_table.on('click-row.bs.table', function(e, row, $element){
                            modal_elem.data('participant', row);
                            if (modal_elem.data('selected_element') != null)
                                modal_elem.data('selected_element').children().removeClass('selected');
                            modal_elem.data('selected_element', $element);
                            $element.children().addClass('selected');
                        });
                    });
            });
        },

        _get_combined_participants: function(){
            var _this = this;
            var participants = {};
            $.each(this.advancement_rules, function(key, participant){
                var p = {};
                $.extend(p, participant);
                p['type'] = 'rule';
                p['surfer_color'] = _this.colors[p['seed'] % _this.colors.length]['COLOR'];
                participants[participant['seed']] = p;
            });

            $.each(this.proposed_participants, function(key, participant){
                var p = {};
                $.extend(p, participant);
                p['type'] = 'proposal';
                p['surfer_color'] = _this.colors[p['seed'] % _this.colors.length]['COLOR'];
                participants[participant['seed']] = p;
            });

            $.each(this.participants, function(key, participant){
                var p = {};
                $.extend(p, participant);
                p['type'] = 'participant';
                participants[participant['seed']] = p;
            });

            return participants;
        },

        _get_nonparticipating_surfers: function(){
            var surfers = [];
            var p_set = new Set();
            for (var idx in this.participants){
                p_set.add(this.participants[idx]['surfer_id']);
            }
            // TODO: test if this.surfers is empty/none and if so, get from server
            $.each(this.surfers, function(idx, surfer){
                if (!p_set.has(surfer['id'])){
                    surfers.push(surfer);
                }
            });
            return surfers;
        },


        _add_interactive_fields: function(participant, type){
            var s = '<select class="form-control"  data-seed="' + participant['seed'] + '">';
            for (var val in this.colors) {
                var sel = '';
                if (participant['surfer_color'] === this.colors[val]['COLOR'])
                    sel = 'selected=selected';
                s = s + '<option ' + sel + ' value="' + this.colors[val]['COLOR'] + '">' + this.colors[val]['COLOR'] + '</option>';
            }
            s = s + '</select>';

            var action_field = '';
            if (type == 'proposal'){
                action_field = '<button data-seed=' + participant['seed'] + ' class="btn btn-success remove_pending_btn"><span class="fa fa-check"></span></button>';
            } else if (type == 'participant') {
                action_field = '<button data-seed=' + participant['seed'] + ' class="btn btn-danger remove_participant_btn"><span class="fa fa-times-circle"></span></button>';
            } else if (type == 'rule') {
                action_field = '';
            } else {
                action_field = '';
            }
            var edit_field = '&nbsp; <button data-seed=' + participant['seed'] + ' class="btn btn-info edit_participant_btn"><span class="fa fa-edit"></span></button>';

            var res = $.extend({}, participant);
            res['color'] = s;
            res['action'] = action_field + edit_field;
            return res;
        },


        remove_participant: function(seed){
            delete this.participants[seed];
            this._refresh();
        },

        confirm_participant: function(seed){
            this.participants[seed] = $.extend({}, this.proposed_participants[seed])
            delete this.participants[seed]['proposal'];
        },

        remove_pending: function(seed){
            this.confirm_participant(seed);
            this._refresh();
        },

        set_participant: function(seed, data){
            var participants = this._get_combined_participants();
            var new_seed = -1;
            if (seed == 'new'){
                var max_existing_seed = -1;
                for (seed in participants)
                    max_existing_seed = Math.max(max_existing_seed, participants[seed]['seed']);
                new_seed = max_existing_seed + 1;
            }
            else
                new_seed = parseInt(seed);

            var existing_participant = this.participants[new_seed];
            this.participants[new_seed] = data;
            if (existing_participant){
                this.participants[new_seed]['surfer_color'] = existing_participant['surfer_color'];
            }
            else {
                var color = this.colors[new_seed % this.colors.length]['COLOR'];
                if (color)
                    this.participants[new_seed]['surfer_color'] = color;
            }
            this.participants[new_seed]['seed'] = new_seed;
            this.participants[new_seed]['surfer_id'] = this.participants[new_seed]['id'];
            this.participants[new_seed]['heat_id'] = this.options.heat_id;
            this._refresh();
            this._mark_dirty();
        },

        _fetch_surfer_colors: function(){
            var _this = this;

            this.element.find('.participants_table select option:selected').each(function(){
                var seed = parseInt($(this).parent().data('seed'));
                if (_this.participants[seed]){
                    _this.participants[seed]['surfer_color'] = $(this).val();
                }
            });
        },

        _check_data: function(){
            var colors = new Set();
            var ids = new Set();
            for (seed in this.participants){
                var color = this.participants[seed]['surfer_color'];
                if (colors.has(color)){
                    alert('Double entries for "Surfer Color"');
                    return false;
                }
                colors.add(color);

                var id = this.participants[seed]['surfer_id'];
                if (ids.has(id)){
                    alert('Surfer entered twice');
                    return false;
                }
                ids.add(id);
            }
            return true;
        },

        upload: function(){
            var _this = this;
            this._fetch_surfer_colors();
            var okay = this._check_data();
            if (!okay)
                return;

            var plist = [];
            $.each(this.participants, function(key, participant){
                plist.push(participant);
            });
            var participants = JSON.stringify(plist);

            var deferred = $.post('/tournament_admin/do_set_participating_surfers', {heat_id: this.options.heat_id, participants: participants});

            deferred.done(function(ev_part){
                _this._refresh();
                _this._trigger('data_changed');
                _this._mark_clean();
            });
            return deferred;
        },

        _mark_dirty: function(){
            this.element.find('.dirty_marker').addClass('alert-danger');
        },

        _mark_clean: function(){
            this.element.find('.dirty_marker').removeClass('alert-danger');
        },

    });
}(jQuery));
