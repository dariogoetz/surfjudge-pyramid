/* =========================================================
 * advancement_editor.js
 * =========================================================
 * Copyright 2016 Dario Goetz
 * ========================================================= */
(function($, undefined){

    $.widget('surfjudge.generate_heats', {
        options: {
            category_id: null,
            postheaturl: '/rest/heats',
            postadvancementsurl: '/rest/advancements',
            postsurferurl: '/rest/surfers',
            putparticipantsurl: '/rest/participants',
            getlycracolorsurl: '/rest/lycra_colors',
            heatchart_width: 520,
            margin_left: 0,
            margin_right: 0,
            margin_top: 0,
            margin_bottom: 0,
        },

        _create: function(){

            this.prelim_heat_data = null; // containing server data
            this.prelim_advancement_data = null; // containing server data

            this.generator = new TournamentGenerator({
                postheaturl: this.options.postheaturl,
                postadvancementsurl: this.options.postadvancementsurl,
                postsurferurl: this.options.postsurferurl,
                putparticipantsurl: this.options.putparticipantsurl,
                getlycracolorsurl: this.options.getlycracolorsurl,
            });

            this._init_html();
            this._register_events();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
           var _this = this;
            html = $([
                '<div class="form-horizontal">',
                '    <div class="form-group row">',
                '        <label class="col-4 control-">Number of rounds</label>',
                '        <div class="col-4">',
                '            <div class="input-group plusminusinput">',
                '                <span class="input-group-btn">',
                '                    <button type="button" class="btn btn-danger btn-number" data-type="minus" data-field="nheats">',
                '                        <span class="fa fa-minus"></span>',
                '                    </button>',
                '                </span>',
                '                <input type="text" name="nheats" class="form-control input-number" data-key="nheats" placeholder="3" min="1" max="100" value="2">',
                '                <span class="input-group-btn">',
                '                    <button type="button" class="btn btn-success btn-number" data-type="plus" data-field="nheats">',
                '                        <span class="fa fa-plus"></span>',
                '                    </button>',
                '                </span>',
                '            </div>',
                '        </div>',
                '        <div class="col-4">',
                '            <div class="float-right">',
                '                <button type="button" class="btn btn-secondary upload_csv">Load CSV</button>',
                '                <button type="button" class="btn btn-danger clear_csv" disabled>Clear CSV</button>',
                '            </div>',
                '        </div>',
                '    </div>',
                '</div>',
                '<h4>Preview</h4>',
                '<div class="heatchart">',
                '</div>',
                '<div class="float-right">',
                '    <button type="button" class="btn btn-primary upload_btn" disabled>Save</button>',
                '</div>',

            ].join(' '));

            this.element.append(html);

            // ***** plusminus buttons *****
            this.element.find('.plusminusinput').plusminusinput();
            this._generate_chart();
        },

        _register_events: function(){
            this._on(this.element, {
                'click .upload_btn': this.upload,
                'change .input-number': this._generate_chart,
                'click .upload_csv': this._show_upload_csv_widget,
                'click .clear_csv': this._clear_csv_data,
            });
        },

        _clear_csv_data: function(){
            var $btn = this.element.find('.clear_csv');
            if ($btn.attr('disabled')) {
                return;
            } else {
                this.element.find('.upload_csv').data('participants', null);
                $btn.attr('disabled', true);
                this._generate_chart();
            }
        },

        _show_upload_csv_widget: function() {
            var _this = this;
            var html = $([
                '<div class="upload_widget"></div>',
            ].join(' '));
            var bb = bootbox.dialog({
                title: 'Upload Category Partcicipants',
                message: html,
                buttons: {
                    'cancel': {
                        label: 'Cancel',
                        className: 'btn btn-default',
                    }
                }
            });

            bb.init(function(){
                bb.find('.upload_widget').csv_upload({
                    required_columns: ['seed', 'first_name', 'last_name'],
                    expected_columns: ['seed', 'first_name', 'last_name'],
                    delimiter: "", // auto
                });
                bb.find('.upload_widget').on('csv_uploaddata_changed', function(ev, data, b, c){
                    // feed upload_data to heatchart / tournament_generator
                    data['data'].sort(function(a, b) {
                        return a['seed'] - b['seed'];
                    });
                    _this.element.find('.upload_csv').data('participants', data['data']);
                    _this._generate_chart();
                    _this.element.find('.clear_csv').attr('disabled', false);
                    bb.modal('hide');
                });
            });
        },

        _generate_chart: function() {
            var n_rounds = this.element.find('.input-number').val();
            var participant_data = this.element.find('.upload_csv').data('participants');
            this.generator.generate_heat_structure(n_rounds);

            if (participant_data) {
                this.generator.fill_seeds(participant_data);
            }
            this._show_heatchart();
        },

        _show_heatchart: function(){
            var heatchart_data = this.generator.generate_heatchart_data();

            var heatchart_elem = this.element.find('.heatchart');
            if (heatchart_elem.data('surfjudgeHeatchart') != null)
                heatchart_elem.heatchart('destroy');
            heatchart_data['width'] = this.options.heatchart_width;
            heatchart_data['margin_left'] = this.options['margin_left'];
            heatchart_data['margin_right'] = this.options['margin_right'];
            heatchart_data['margin_top'] = this.options['margin_top'];
            heatchart_data['margin_bottom'] = this.options['margin_bottom'];
            heatchart_elem.heatchart(heatchart_data);

            this._activate_upload_btn();
        },

        _activate_upload_btn: function(){
            if (this.generator.heat_structure_data != null)
                this.element.find('.upload_btn').attr('disabled', false);
            else
                this.element.find('.upload_btn').attr('disabled', true);
        },

        upload: function(){
            var _this = this;
            if (this.generator.heat_structure_data != null && this.options.category_id != null){
                var deferred = this.generator.upload_heat_structure(this.options.category_id);
                deferred.done(function(){
                    _this._trigger('data_changed');
                });
            } else {
            }
        },
    });

    var TournamentGenerator = function(url_options){
        this.heat_structure_data = null;
        this.options = $.extend({}, url_options);
    };

    TournamentGenerator.prototype = {
    constructor: TournamentGenerator,

    generate_heat_structure: function(n_rounds) {
        // generates an object with fields
        // "advancing_surfers": map round -> {heat_idx: advancement_data and
        // "heats": map heat_idx -> {round, heat, id, name}
        var _this = this;
        this.n_rounds = n_rounds;
        var heat_idx = 0;
        // heats is a hash map round+heat to (temporary) index and name
        var heats = new Map();
        heats.set(String([0, 0]), {
            round: 0,
            heat: 0,
            id: heat_idx++,
            name: _this.gen_heat_name(0, 0, 0)})

        var advancements = new Map();
        var rnd = 0;
        var n_heats_for_rnd = 1;
        while (rnd < n_rounds - 1) {
            for (var hidx = 0; hidx < n_heats_for_rnd; hidx++) {
                advancing_from = {};
                for (var seed = 0; seed < 4; seed++) {
                    var adv = {};
                    adv[seed] = this._advances_from(rnd, hidx, seed);
                    advancing_from = $.extend(true, advancing_from, adv);
                    var from_rnd = advancing_from[seed]['round'];
                    var from_heat = advancing_from[seed]['heat'];

                    if (!heats.has(String([from_rnd, from_heat]))) {
                        heats.set(String([from_rnd, from_heat]), {
                            round: from_rnd,
                            heat: from_heat,
                            id: heat_idx++,
                            name: _this.gen_heat_name(from_rnd, from_heat, n_rounds),
                        });
                    }
                }
                if (!(advancements.has(rnd))){
                    advancements.set(rnd, {});
                }
                advancements.get(rnd)[hidx] = advancing_from;
            }
            rnd += 1;
            n_heats_for_rnd = 2**rnd;
        }
        this.heat_structure_data = {advancing_surfers: advancements, heats: heats};
        return this.heat_structure_data;
    },

    _advances_from: function(rnd, hidx, seed) {
        var from_rnd = rnd+1;
        var from_place = Math.floor(seed/2);
        var from_heat;
        if (seed < 2 || rnd == 0)
            from_heat = 2*hidx + seed%2;
        else {
            if (seed < 4)
                from_heat = 2 * (hidx - (hidx%2) + (hidx+1)%2) + seed%2;
            else
                console.log('Error: More than 4 seeds');
        }
        return {round: from_rnd, heat: from_heat, place: from_place};
    },

    gen_heat_name: function(rnd, hidx, n_rounds) {
        res = '';
        if (rnd==0) {
            res = 'Final';
        } else if (rnd == 1) {
            res = 'Semi-Final ' + (hidx+1);
        } else if (rnd == 2) {
            res = 'Quarter-Final ' + (hidx+1);
        } else {
            res = 'Round ' + (n_rounds - rnd) + ' Heat ' + (hidx + 1);
        }
        return res;
    },

    generate_heatchart_data: function() {
        // generate arrays for advancement data and heat data as received from server
        if (this.heat_structure_data === null)
            return;
        var _this = this;
        var gen_heat_tpl = function(){
            var tmp_parts = d3.map();
            tmp_parts.set(0, {'name': 'Seed 1'});
            tmp_parts.set(1, {'name': 'Seed 2'});
            tmp_parts.set(2, {'name': 'Seed 3'});
            tmp_parts.set(3, {'name': 'Seed 4'});
            return tmp_parts;
        };

        var heats_data = [];
        this.heat_structure_data['heats'].forEach(function(heat, key){
            var new_heat = $.extend({}, heat);
            new_heat['participants'] = gen_heat_tpl();
            if (_this.heat_structure_data['participants'] && _this.heat_structure_data['participants'].get(key)) {
                var heat_participants = _this.heat_structure_data['participants'].get(key);
                heat_participants.forEach(function(participant){
                    // set all known participants
                    var seed = parseInt(participant['seed']);
                    new_heat['participants'].set(seed, participant);
                });
            }
            heats_data.push(new_heat)
        });
        var advancement_data = [];
        this.heat_structure_data['advancing_surfers'].forEach(function(heats, level){
            $.each(heats, function(idx, heat_advancements){
                var target_heat = _this.heat_structure_data['heats'].get(String([level, idx]));
                var advancement_rules = {};
                $.each(heat_advancements, function(seed, origin){
                    var origin_heat = _this.heat_structure_data['heats'].get(String([origin['round'], origin['heat']]));

                    // prepare advancement rule for this seed
                    advancement_data.push({
                        to_heat_id: target_heat['id'],
                        from_heat_id: origin_heat['id'],
                        seed: parseInt(seed),
                        place: origin['place'],
                        name: 'Seed ' + (seed+1),
                    });
                });
            });
        });
        return {'advancement_data': advancement_data, 'heat_data': heats_data};
    },

    upload_heat_structure: function(category_id){
        var _this = this;

        // upload surfers and retrieve corresponding surfer_ids
        var deferreds_preparation = [];
        if (this.heat_structure_data['participants']) {
            this.heat_structure_data['participants'].forEach(function(heat_data) {
                heat_data.forEach(function(participant){
                    var deferred = $.Deferred();
                    $.post(_this.options.postsurferurl + '/new', JSON.stringify(participant['surfer']))
                    .done(function(new_part){
                        participant['surfer_id'] = new_part['id'];
                        deferred.resolve();
                    })
                    .fail(function(){
                        console.log('Could not post new surfer');
                        deferred.resolve();
                    });
                    deferreds_preparation.push(deferred.promise());
                });
            });
        }

        // fetch lycra colors
        var lycra_colors = [];
        var deferred_lycra = $.Deferred();
        $.getJSON(this.options.getlycracolorsurl)
            .done(function(data){
                lycra_colors = data;
                deferred_lycra.resolve();
            })
            .fail(function(){
                console.log('Could not load lycra colors.');
                deferred_lycra.resolve();  // reject would fire later $.when to soon
            });
        deferreds_preparation.push(deferred_lycra.promise());

        // upload new heats and retrieve corresponding heatids
        var deferreds = [];
        var heat_id_mapping = new Map();
        var deferred = $.Deferred();

        // wait until surfers have their ids
        $.when.apply($, deferreds_preparation).then(function(){
            // then upload heats
            _this.heat_structure_data['heats'].forEach(function(heat, level_idx_str){
                var level = parseInt(level_idx_str.split(',')[0])
                var idx = parseInt(level_idx_str.split(',')[1]);
                var data = {};
                data['name'] = _this.gen_heat_name(level, idx++, _this.n_rounds);
                data['category_id'] = category_id;

                var deferred_heat = $.Deferred();
                $.post(_this.options.postheaturl + '/new', JSON.stringify(data), function(res_heat){
                    // store new heat id
                    var heat_id = res_heat['id'];
                    heat_id_mapping.set(level + ' ' + heat['heat'], parseInt(heat_id));

                    // upload participants for this heat
                    if (_this.heat_structure_data['participants'] && _this.heat_structure_data['participants'].get(level_idx_str)) {
                        var participant_data = [];
                        var heat_participants = _this.heat_structure_data['participants'].get(level_idx_str);
                        heat_participants.forEach(function(participant){
                            var p = {};
                            p['seed'] = participant['seed'];
                            p['surfer_id'] = participant['surfer_id'];
                            p['heat_id'] = heat_id;
                            var color = lycra_colors[participant['seed'] % lycra_colors.length] || lycra_colors[0];
                            p['surfer_color'] = color['COLOR'];
                            participant_data.push(p);
                        });
                        $.ajax({
                            type: 'PUT',
                            url: _this.options.putparticipantsurl + '/' + heat_id,
                            data: JSON.stringify(participant_data),
                        })
                        .done(function(){deferred_heat.resolve();})
                        .fail(function(){
                            console.log('Could not PUT participants for heat', heat_id);
                            deferred_heat.resolve();
                        });
                    } else {
                        // no participants need to be uploaded
                        deferred_heat.resolve();
                    }
                });
                deferreds.push(deferred_heat.promise());
            });

            $.when.apply($, deferreds).done(function(){
                // upload advancement rules corresponding to new heatids
                var rules = [];
                _this.heat_structure_data['advancing_surfers'].forEach(function(heats, level){
                    $.each(heats, function(heat, seeds){
                        var heat_id = heat_id_mapping.get(level + ' ' + heat);
                        $.each(seeds, function(seed, advancement_data){
                            var data = {};
                            data['to_heat_id'] = heat_id;
                            data['seed'] = parseInt(seed);
                            var key = advancement_data['round'] + ' ' + advancement_data['heat'];
                            data['from_heat_id'] = heat_id_mapping.get(key);
                            data['place'] = advancement_data['place'];
                            rules.push(data);
                        });
                    })
                });
                $.post(_this.options.postadvancementsurl, JSON.stringify(rules), function(res){
                    deferred.resolve();
                });
            });
        });
        return deferred.promise();
    },

    _map_surfer_to_heat_seed: function(seed_idx, nheats_first_lvl) {
        var res_heat = 0;
        for (var level = 0; level < Math.ceil(Math.log2(nheats_first_lvl)); level++)
            res_heat += Math.floor(seed_idx % nheats_first_lvl / 2**(level) % 2) * Math.ceil(nheats_first_lvl/ 2**(level+1));
        res_seed = Math.floor(seed_idx / nheats_first_lvl);
        return {heat: res_heat, seed: res_seed}
    },

    _map_heat_seed_to_surfer__unused: function(nheats_first_lvl, heat_idx, heat_seed) {
        var res_seed = heat_seed * nheats_first_lvl;
        for (var level = 0; level < Math.ceil(Math.log2(nheats_first_lvl)); level++)
            res_seed += (Math.floor((heat_idx * 2**(level+1))/nheats_first_lvl) % 2 ) * 2**level;
        return res_seed;
    },

    fill_seeds: function(participants, relative_seeds) {
        var _this = this;
        var level_heats = new Map();

        // get number of heats in first round
        var heats_by_round = new Map();
        var first_round_index = 0;
        this.heat_structure_data['heats'].forEach(function(heat){
            var round = heat['round'];
            var round_heats = heats_by_round.get(round) || [];
            round_heats.push(heat);
            heats_by_round.set(round, round_heats);
            first_round_index = Math.max(first_round_index, round);
        });
        var nheats_first_round = heats_by_round.get(first_round_index).length;
        var heat_participants = new Map();
        $.each(participants, function(idx, participant){
            // set global seed:
            // if relative_seeds is set, idx is chosen, participants are filled "tightly"
            // else, seed from data is chosen, some seeds may be left out
            var global_seed;
            if (relative_seeds) {
                global_seed = idx;  // for compact filling
            } else {
                global_seed = parseInt(participant['seed']);  // for allowing holes in filling
            }

            var heat_seed = _this._map_surfer_to_heat_seed(global_seed, nheats_first_round);
            var p = {};
            p['seed'] = heat_seed['seed'];
            p['surfer'] = participant;
            var heat_idx = String([first_round_index, heat_seed['heat']]);
            if (heat_participants.has(heat_idx)) {
                heat_participants.get(heat_idx).set(heat_seed['seed'], p);
            } else {
                var parts = new Map();
                parts.set(heat_seed['seed'], p);
                heat_participants.set(heat_idx, parts);
            }
        });
        this.heat_structure_data['participants'] = heat_participants;
    },
}

}(jQuery));
