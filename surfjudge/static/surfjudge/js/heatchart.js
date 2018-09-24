/* =========================================================
 * advancement_editor.js
 * =========================================================
 * Copyright 2016 Dario Goetz
 * ========================================================= */

(function($, undefined){

    var D3HeatElemGenerator = function(elem, svg_heats, heat_width, slot_height, focus_heat_ids){
        this.elem = elem;

        this.svg_heats = svg_heats;

        this.heat_width = heat_width;
        this.slot_height = slot_height;

        this.focus_heat_ids = focus_heat_ids;

    };

    D3HeatElemGenerator.prototype = {
        constructor: D3HeatElemGenerator,

        _translate: function(x, y){
            return 'translate(' + x + ',' + y + ')';
        },

        _map_heat_seed_to_surfer: function(nheats_first_lvl, heat_idx, heat_seed) {
            var levels = Math.ceil(Math.log2(nheats_first_lvl));

            var res_seed = heat_seed * nheats_first_lvl;
            $.each(d3.range(levels), function(level){
                res_seed += (Math.floor((heat_idx * 2**(level+1))/nheats_first_lvl) % 2 ) * 2**level;
            });
            return res_seed;
        },

        generate: function(){
            var heat_enter = this.elem.append('g').selectAll('.heat_node')
                .data(this.svg_heats)
                .enter();

            var focus_heat_elem = this.gen_focus_heat_elem(heat_enter);

            var heat_elems = this.gen_heat_elems(heat_enter);
            this.gen_heat_boxes(heat_elems);
            this.gen_heat_labels(heat_elems);


            var seed_elems = this.gen_heat_seed_elems(heat_elems);
            this.gen_heat_seed_boxes(seed_elems);
            this.gen_heat_seed_labels(seed_elems);

            var place_elems = this.gen_heat_place_elems(heat_elems);
            this.gen_heat_place_boxes(place_elems);
            this.gen_heat_place_labels(place_elems);
        },

        gen_heat_elems: function(d3_selector){
            var _this = this;
            var group = d3_selector.append('g')
                .attr('class', 'heat_node')
                .attr('data-heatid', function(node, i){ return node['id']; })
                .attr('transform', function(d, i){
                    return _this._translate(d['x'], d['y']);
                });
            return group;
        },

        gen_heat_boxes: function(d3_selector){
            var _this = this;
            var rect = d3_selector.append('rect')
                .attr('fill', 'white')
                .attr('stroke', 'black')
                .attr('width', this.heat_width)
                .attr('height', function(node){ return _this.slot_height * node['n_participants']; });
            return rect
        },

        gen_heat_labels: function(d3_selector){
            var _this = this;
            var text = d3_selector.append('text')
                .attr('y', -5)
                .text(function(node){
                    return 'name' in node['heat_data'] ? node['heat_data']['name'] : 'heat not available - deleted?';
                })
                .attr('font-weight', 'bold');
            return text;
        },

        gen_focus_heat_elem: function(d3_selector){
            var _this = this;
            var size = 20;
            var focus_elem = d3_selector.filter(function(d){
                if (_this.focus_heat_ids != null)
                    return _this.focus_heat_ids.indexOf(d['heat_data']['id']) >= 0;
                return false;
            })
                .append('g')
                .attr('class', 'focus_heat')
                .attr('transform', function(d, i){ return _this._translate(d['x'], d['y'])})
                .append('rect')
                .attr('x', -size)
                .attr('y', -size)
                .attr('width', _this.heat_width + 2 * size)
                .attr('height', function(d, i){ return _this.slot_height * d['n_participants'] + 2 * size});
            return focus_elem;
        },

        gen_heat_seed_elems: function(d3_selector){
            var _this = this;
            var seeds = d3_selector.selectAll('.heat_seed')
                .data(function(d){
                    return d3.range(d['n_participants']).map(function(i){
                        return {node: d, seed: i};
                    });
                })
                .enter()
                .append('g')
                .attr('class', 'heat_seed')
                .attr('transform', function(d, i){ return _this._translate(0, d['seed'] * _this.slot_height)});
            return seeds;
        },

        gen_heat_seed_boxes: function(d3_selector){
            var _this = this;
            var boxes = d3_selector.append('rect')
                .attr('fill', function(d, i){
                    var p = 'participants' in d['node']['heat_data'] ? d['node']['heat_data']['participants'] : d3.map();
                    var seed = d['seed'];
                    if (p.has(seed) && p.get(seed)['surfer_color_hex']){
                        return p.get(seed)['surfer_color_hex'];
                    }
                    else
                        return 'white';
                })
                .attr('stroke', 'black')
                .attr('width', 0.4 * _this.heat_width)
                .attr('height', _this.slot_height);
            return boxes;
        },

        gen_heat_seed_labels: function(d3_selector){
            var _this = this;
            var labels = d3_selector.append('text')
                .attr('x', 0.2 * this.heat_width)
                .attr('y', this.slot_height * 2.0 / 3)
                .attr('text-anchor', 'middle')
                .attr('alignment-baseline', "middle")
                .text(function(d, i){
                    var p = 'participants' in d['node']['heat_data'] ? d['node']['heat_data']['participants'] : d3.map();
                    var seed = d['seed'];
                    if (p.has(seed) && (p.get(seed)['surfer'] != null)) {
                        var s = p.get(seed)['surfer'];
                        return s['first_name'] + ' ' + s['last_name'];
                    } else
                        return 'Seed ' + (_this._map_heat_seed_to_surfer(d['node']['level_elements'], d['node']['height_level'], d['seed']) + 1);
                });
            return labels;
        },

        gen_heat_place_elems: function(d3_selector){
            var _this = this;
            var places = d3_selector.selectAll('.heat_place')
                .data(function(d){return d3.range(d['n_participants']).map(function(i){return {node: d, place: i}});})
                .enter()
                .append('g')
                .attr('class', function(d, i){
                    switch (i){
                    case 0:
                        return 'heat_place first';
                    case 1:
                        return 'heat_place second';
                    case 2:
                        return 'heat_place third';
                    default:
                        return 'heat_place';
                    }
                })
                .attr('transform', function(d, i){ return _this._translate(0.6 * _this.heat_width, + d['place'] * _this.slot_height)});
            return places;
        },

        gen_heat_place_boxes: function(d3_selector){
            var _this = this;
            var boxes = d3_selector.append('rect')
                .attr('fill', 'white')
                .attr('stroke', 'black')
                .attr('width', 0.4 * this.heat_width)
                .attr('height', this.slot_height);
            return boxes;
        },

        gen_heat_place_labels: function(d3_selector){
            var _this = this;
            var labels = d3_selector.append('text')
                .attr('x', 0.2 * this.heat_width)
                .attr('y', this.slot_height * 2.0 / 3)
                .attr('text-anchor', 'middle')
                .attr('alignment-baseline', "middle")
                .text(function(d, i){
                    var result = d['node']['heat_data']['results'] || [];
                    var label = (d['place']+1) + '. place';
                    if (result[i]){
                        var s = result[i]['surfer'];
                        label = s['first_name'] + ' ' + s['last_name'];
                    }
                    return  label;
                });
            return labels;
        },
    };


    var D3LinkElemGenerator = function(elem, svg_links, heat_width, slot_height){
        this.elem = elem;

        this.svg_links = svg_links;

        this.heat_width = heat_width;
        this.slot_height = slot_height;
    };

    D3LinkElemGenerator.prototype = {

        constructor: D3LinkElemGenerator,

        _link_path: function(link){
            var s_x = link['source']['x'];
            var t_x = link['target']['x'];
            var s_y = link['source']['y'];
            var t_y = link['target']['y'];
            var curvature = 0.5;
            var x0 = s_x + this.heat_width,
                x1 = t_x,
                xi = d3.interpolateNumber(x0, x1),
                x2 = xi(curvature),
                x3 = xi(1 - curvature),
                y0 = s_y + this.slot_height * (0.5 + link['place']),
                y1 = t_y + this.slot_height * (0.5 + link['seed']);
            return "M" + x0 + "," + y0
                + "C" + x2 + "," + y0
                + " " + x3 + "," + y1
                + " " + x1 + "," + y1;
        },

        generate: function(){
            var _this = this;
            this.elem.append('g')
                .selectAll('.link')
                .data(this.svg_links)
                .enter().append("path")
                .attr("class", "link")
                .attr("d", function(d, i){return _this._link_path(d);})
                .style("stroke-width", 1)
                .append('g')
                .attr('class', 'link');
        },
    };




    $.widget('surfjudge.heatchart', {
        options: {
            category_id: null,
            heat_data: null,
            advancement_data: null,

            getadvancementsurl: '/rest/advancements',
            getparticipantsurl: '/rest/participants',
            getheatsurl: '/rest/heats',
            getresultsurl: '/rest/results',

            width: 1200,
            margin_top: 0,
            margin_right: 0,
            margin_bottom: 0,
            margin_left: 0,
        },

        _create: function(){
            this._internal_width = null; // will be overwritten later
            this._internal_height = null; // will be overwritten later

            this.heat_data = null; // containing server data
            this.advancement_data = null; // containing server data
            this.svg_heats = null; // used as elements for d3
            this.svg_links = null; // used as elements for d3

            this.slot_height = 18;
            this.heat_width = 250
            this.x_padding = 100;
            this.y_padding = 50;


            this.svg_elem = null;

            if (this.options.category_id !== null)
                this.initialized = this.refresh();
            else {
                this.load(this.options.heat_data, this.options.advancement_data);
                this.initialized = $.Deferred().resolve().promise();
            }
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_svg: function(){
            this.element.empty();

            var ext2int = this._internal_width / (this.options.width - this.options.margin_left - this.options.margin_right);
            this.svg_elem = d3.select(this.element[0]).append("svg")
                .attr("viewBox",
                      (- this.options.margin_left * ext2int) + " "
                      + (- this.options.margin_top * ext2int) + " "
                      + (this._internal_width + this.options.margin_left * ext2int + this.options.margin_right * ext2int) + " "
                      + (this._internal_height + this.options.margin_top * ext2int + this.options.margin_bottom * ext2int))
                .attr("preserveAspectRatio", "xMinYMin meet")
                .attr("width", this.options.width)
                .attr("height", this.options.width * (this._internal_height / this._internal_width) || 0)
                .append("g");
        },

        get_heats_db: function(){
            return this.heats_db;
        },

        load: function(heats_db, advancement_data){
            this.heats_db = heats_db;
            this.advancement_data = advancement_data;
            this._refresh();
        },

        refresh: function(){
            var _this = this;
            this.heats_db = [];
            this.advancement_data = [];
            var res_deferred = new $.Deferred();

            var deferreds = [];

            var deferred = $.Deferred();
            deferreds.push(deferred.promise());

            $.getJSON(this.options.getadvancementsurl + '/' + this.options['category_id'], function(advancement_rules) {
                _this.advancement_data = advancement_rules;
                deferred.resolve();
            })
                .fail(function(){
                    console.log('Failed to load advancement rules for heatchart.')
                    deferred.resolve();  // reject would fire later $.when to soon
                });

            $.getJSON(this.options.getheatsurl, {category_id: this.options['category_id']}, function(heats) {
                _this.heats_db = heats;
                $.each(heats, function(idx, heat){
                    // get heat participants
                    var deferred_part = $.Deferred();
                    deferreds.push(deferred_part.promise());

                    $.getJSON(_this.options.getparticipantsurl + '/' + heat['id'], function(participants){
                        heat['participants'] = d3.map(participants, function(p){return parseInt(p['seed'])});
                        deferred_part.resolve();
                    })
                        .fail(function(){
                            console.log('Failed to load participants for heatchart: heat ' + heat['id']);
                            deferred_part.resolve();  // reject would fire later $.when to soon
                        });

                    // get results for heat
                    var deferred_res = $.Deferred();
                    deferreds.push(deferred_res.promise());
                    $.getJSON(_this.options.getresultsurl + '/' + heat['id'], function(result_data){
                        heat['results'] = result_data.sort(function(a,b){return a['place'] - b['place']});
                        deferred_res.resolve();
                    })
                        .fail(function(){
                            console.log('Failed to load results for heatchart: heat ' + heat['id']);
                            deferred_res.resolve();  // reject would fire later $.when to soon
                        });
                });
                $.when.apply($, deferreds).done(function(){
                    _this._refresh();
                    res_deferred.resolve();
                });
            });
            return res_deferred.promise();
        },

        _refresh: function(){
            this._init_heat_structure_data();
            this._init_svg();
            this._redraw();
        },

        _redraw: function(){
            this._draw_heats();
            this._draw_links();
        },

        _draw_heats: function(){
            var heats = [];
            this.svg_heats.forEach(function(node){heats.push(node)});
            var heat_elem_generator = new D3HeatElemGenerator(this.svg_elem, heats, this.heat_width, this.slot_height, this.options.focus_heat_ids);
            heat_elem_generator.generate();
        },

        _draw_links: function(){
            var link_elem_generator = new D3LinkElemGenerator(this.svg_elem, this.svg_links, this.heat_width, this.slot_height);
            link_elem_generator.generate();
        },

        _init_heat_structure_data: function(){
            var _this = this;
            this.svg_heats = new Map();
            this.svg_links = [];
            // init a map with one svg_heat element for each heat in heats_db
            // these elements shall in the end have fields
            // - for each seed and each place and corresponding target/source heat
            // - x, y coordinates in terms of rounds of the tournament and heat order
            // - link to the corresponding heat_info in heat_db

            // generate empty objects for each svg heat
            $.each(this.heats_db, function(idx, heat){
                _this.svg_heats.set(parseInt(heat['id']), {
                    'id':  heat['id'],
                    'in_links':  [],
                    'out_links': [],
                    'seeds':  {},
                    'heat_data': heat,
                });
            });

            // fill connectors of svg heats and svg links
            $.each(this.advancement_data, function(idx, rule){
                var src_svg_heat = _this.svg_heats.get(parseInt(rule['from_heat_id'])) || null;
                if (src_svg_heat == null)
                    return;
                var tgt_svg_heat = _this.svg_heats.get(parseInt(rule['to_heat_id']));
                var seed = parseInt(rule['seed']);
                var place = parseInt(rule['from_place']);
                var link = {
                    'source': src_svg_heat,
                    'target': tgt_svg_heat,
                    'seed': seed,
                    'place': place,
                };

                src_svg_heat['out_links'][place] = link;
                tgt_svg_heat['in_links'][seed] = link;
                _this.svg_links.push(link);
            });
            this._determine_x_levels();
            this._determine_y_levels();
            this._determine_number_of_participants();
            this._generate_svg_coordinates();
        },

        _determine_x_levels: function() {
            var _this = this;
            var remaining_heats = [];
            this.svg_heats.forEach(function(heat){
                remaining_heats.push(heat);
            });

            // push heats from left to right
            var level = 0;
            var next_heats;
            while (remaining_heats.length){
                next_heats = [];
                $.each(remaining_heats, function(idx, heat) {
                    heat.level = level;
                    $.each(heat['in_links'], function(idx, link) {
                        if ((link || null) == null)
                            return;
                        if (next_heats.indexOf(link['source']) < 0) {
                            next_heats.push(link['source']);
                        }
                    });
                });
                remaining_heats = next_heats;
                level++;
            }
        },

        _determine_y_levels: function() {
            var _this = this;
            var lvl2heats = [];
            var roots = [];
            var order = [0,2,1,3];
            this.svg_heats.forEach(function(heat){
                var lvl = heat['level'];
                if (!(lvl in lvl2heats))
                    lvl2heats[lvl] = [];
                lvl2heats[lvl].push(heat);
                if (heat['out_links'].length == 0)
                    roots.push(heat);
            });
            var n_levels = d3.keys(lvl2heats).length;
            var lvlmaxheight = d3.range(n_levels).map(function(){return 0});
            $.each(roots, function(idx, heat){
                var height_level = lvlmaxheight[0]++;
                heat.height_level = height_level;

                for (var lvl = 0; lvl < n_levels; lvl++){
                    // propagate height levels through "in links" in seeding order
                    var level_heats = lvl2heats[lvl].sort(function(a,b){ return a.height_level > b.height_level});
                    var idx = 0;
                    level_heats.forEach(function(heat, _, elems){
                        heat.level_elements = elems.length;
                        heat.in_links.forEach(function(link){
                            if ('height_level' in link.source)
                                return;
                            link.source.height_level = idx++;
                        });
                    });
                }
            });
            this.lvl2heats = lvl2heats;
        },


        _determine_number_of_participants: function() {
            var _this = this;
            this.svg_heats.forEach(function(heat){
                var n_filled = 0;
                if (heat['heat_data']['participants'] == null) {
                    n_filled = 1;
                } else {
                    var n_filled = d3.max(heat['heat_data']['participants'].values().map(function(p){
                        return parseInt(p['seed']);
                    })) + 1;
                    if (!n_filled) // e.g. 'seed' field not available
                        n_filled = 1;
                }
                heat['n_participants'] = Math.max(heat['in_links'].length, heat['out_links'].length, n_filled);
            });
        },

        _generate_svg_coordinates: function(){
            var _this = this;

            // prepare number of slots per heat and maximum height
            var max = 0;
            lvl2slots = [];
            $.each(this.lvl2heats, function(lvl, heats){
                var n_slots = 0;
                $.each(heats, function(idx, heat){
                    n_slots += heat['n_participants'] || 0;
                });
                lvl2slots.push(n_slots);
                max = Math.max(max, n_slots * _this.slot_height + (heats.length + 1) * _this.y_padding);
            });

            // set svg dimensions
            this._internal_width = this.x_padding + this.lvl2heats.length * (this.heat_width + this.x_padding);
            this._internal_height = max;

            // set heat coordinates
            var n_levels = this.lvl2heats.length;
            d3.range(n_levels).map(function(lvl){
                var y_padding = (_this._internal_height - lvl2slots[lvl] * _this.slot_height) / (_this.lvl2heats[lvl].length + 1);
                var y = y_padding;
                $.each(_this.lvl2heats[lvl], function(idx, heat){
                    heat['x'] = _this.x_padding + (n_levels - 1 - lvl) * (_this.x_padding + _this.heat_width);
                    heat['y'] = y;
                    y += heat['n_participants'] * _this.slot_height + y_padding;
                });
            });
        },
    });
}(jQuery));
