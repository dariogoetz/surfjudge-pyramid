/* =========================================================
 * placings_table.js
 * =========================================================
 * Copyright 2019 Dario Goetz
 * ========================================================= */

(function($, undefined){
    $.widget('surfjudge.placings_table', {
        options: {
            heat_id: null,
            getresultsurl: 'rest/results/{heatid}',
            getadvancementsurl: '/rest/advancements?from_heat_id={fromheatid}&place={place}',
            postadvancementsrurl: '/rest/advancements/{toheatid}/{seed}',

            websocket_url: null,
            websocket_channels: ['results'],

            decimals: 2,
            fixed_decimals: true, // whether each number should have a fixed number of decimals e.g. 4.00
        },

        _create: function(){
            var _this = this;
            this.data_results = null;
            console.log('creating');

            if (!this._check_inputs()){
                console.log('Inputs of placings_table module not valid.');
                return;
            }

            console.log('Initiating websocket for placings table.')
            var channels = {};
            $.each(this.options.websocket_channels, function(idx, channel){
                channels[channel] = _this.refresh.bind(_this);
            });
            this.websocket = new WebSocketClient({
                url: this.options.websocket_url,
                channels: channels,
                name: 'Placings Table',
            });

            this._init_html();

            this._register_events();
            if (this.options.heat_id !== null)
                this._initialized = this.refresh();
            else
                this._initialized = $.Deferred().resolve().promise();
        },

        _destroy: function(){
            if (this.websocket != null)
                this.websocket.close();
            this.element.empty();
            },

        _check_inputs: function(){
            return true;
        },

        _init_html: function(){
            var _this = this;
            var html = [
                '<table class="table placings_table"></table>',
            ].join(' ');

            this.element.append(html);
        },

        _register_events: function(){
            this._on(this.element, {
                'click .reset_btn': this.refresh,
            });
        },

        refresh: function(){
            console.log('refreshing');
            var _this = this;
            var deferred = $.Deferred();
            if (this.options.heat_id !== null){
                $.getJSON(this.options.getresultsurl.format({heatid: this.options.heat_id}))
                    .done(function(results){
                        if (results != null){
                            _this.data_results = results;
                            console.log(results);
                            _this._refresh();
                            deferred.resolve();
                        } else {
                            console.log('Heat not found.');
                            _this.options.heat_id = null;
                            deferred.reject();
                        }
                    })
                    .fail(function(){
                        console.log('Connection error.');
                        deferred.reject();
                    });
            } else {
                console.log('Nothing to refresh (no heat id specified)');
                _this._refresh();
                deferred.resolve();
            }
            return deferred.promise();
        },

        _refresh: function(){
            var _this = this;
            this.element.find('table').empty();

            // TABLE HEADER
            var header = $('<thead>');
            var row = $('<tr>')
                .append($('<td>', {html: 'Place', class: 'place_cell'}))
                .append($('<td>', {html: 'Surfer', class: 'name_cell'}))
                .append($('<td>', {html: 'Score', class: 'total_score_cell'}))
            header.append(row);

            // TABLE BODY
            var body = $('<tbody>');
            this.data_results.sort(function(a, b){
                return a['place'] - b['place'];
            });

            $.each(this.data_results, function(idx, result_data){
                var row = $('<tr>', {
                    class: "place_{0}".format(result_data['place']),
                })
                    .append($('<td>', {
                        text: (result_data['place'] + 1) + '.',
                        class: 'place_cell',
                        style: ""
                    }))
                    .append($('<td>', {
                        html: result_data['surfer']['first_name'] + ' ' + result_data['surfer']['last_name'],
                        class: 'name_cell',
                    }))
                    .append($('<td>', {
                        text: _this._float_str(_this._round(result_data['total_score'])),
                        class: 'total_score_cell',
                    }));
                body.append(row);
            });


            this.element.find('.placings_table').append(header).append(body);
        },

        _round: function(val, precision) {
            if (precision == null) {
                var precision = this.options.decimals;
            }
            return (Math.round(val * 10**precision) / 10**precision);
        },

        _float_str: function(val){
            if (this.options.fixed_decimals) {
                return val.toFixed(this.options.decimals);
            } else {
                return +parseFloat(val);
            }
        },

        upload: function(){
            // no upload function?
        },


        _check_data: function(){
            // no user input, therefore no check_data?
        },
    });
}(jQuery));
